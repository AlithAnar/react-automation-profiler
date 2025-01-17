import express from 'express';
import fs from 'fs/promises';
import { minify } from 'html-minifier-terser';
import jsdom from 'jsdom';
import yaml from 'js-yaml';
import puppeteer, { Protocol } from 'puppeteer';
import { getFileName, MessageTypes, printMessage } from '../utils/util';
import { IAutomationResultsStorage } from './AutomationResultsStorage';
import {
  AutomationResult,
  Interaction,
  IResults,
  OutputType,
} from '../interfaces';

export interface Scenario {
  id: string;
  shouldSkip?: boolean;
  onBefore?: (page: puppeteer.Page) => Promise<void>;
  onProfile: (page: puppeteer.Page) => Promise<void>;
}

export interface AutomationProps {
  automationCount: number;
  averageOf: number;
  cwd: string;
  includeMount: boolean;
  isServerReady: boolean;
  packagePath: string;
  serverPort: number;
  url: string;
  headless: boolean;
  browserArgs?: string[];
  output: OutputType;
  preloadFilePath?: string;
  cookies?: Protocol.Network.CookieParam[];
  scenarios?: Scenario[];
}

interface SimpleConfig {
  'leading-steps': Array<string>;
  'action-steps': { [step: string]: string };
}

interface AdvancedConfig {
  config?: {
    cookies: {
      [cookie: string]: string;
    };
    headers: {
      [header: string]: string;
    };
  };
  pages: {
    [page: string]: SimpleConfig;
  };
}

type Config = AdvancedConfig | SimpleConfig;

type Flows = {
  [key: string]: string[];
};

enum Actions {
  CLICK = 'click',
  FOCUS = 'focus',
  HOVER = 'hover',
  GOTO = 'goto',
  WAIT = 'wait',
}

export default async function automate(
  props: AutomationProps,
  resultsStorage: IAutomationResultsStorage
): Promise<IResults | null> {
  const {
    automationCount,
    averageOf,
    cwd,
    includeMount,
    isServerReady,
    packagePath,
    serverPort,
    url,
    headless,
    browserArgs,
    output,
    preloadFilePath,
    cookies,
    scenarios,
  } = props;

  const MOUNT = 'Mount';

  const browser = await puppeteer.launch({ headless, args: browserArgs });

  async function initPage(): Promise<puppeteer.Page> {
    const newPage = await browser.newPage();

    if (preloadFilePath) {
      const preloadFile = await fs.readFile(preloadFilePath, 'utf8');
      await newPage.evaluateOnNewDocument(preloadFile);
    }

    if (cookies) {
      newPage.setCookie(...cookies);
    }

    return newPage;
  }

  async function launchWithUrl() {
    await page.goto(url);

    await page.setViewport({
      deviceScaleFactor: 1,
      height: 1080,
      width: 1920,
    });
  }

  let page = await initPage();

  let errorMessage: string = '';

  async function exportResults(): Promise<IResults | null> {
    switch (output) {
      case OutputType.CHART: {
        await appendJsonToHTML();
        return null;
      }
      case OutputType.JSON: {
        return exportJsonBundle();
      }
    }
  }

  async function appendJsonToHTML() {
    const { JSDOM } = jsdom;
    try {
      const contents = await fs.readFile(`${packagePath}/index.html`, 'utf8');
      const { document } = new JSDOM(`${contents}`).window;
      document.querySelectorAll('.json')?.forEach((item) => item.remove());

      const results = resultsStorage.getAllResults();

      Object.keys(results).forEach((flowKey) => {
        const jsonScript = document.createElement('script');
        const result = results[flowKey][0];
        const idArr = result.id.split('-');

        jsonScript.id = `${idArr[0]}-${idArr[1]}`;
        jsonScript.classList.add('json');
        jsonScript.type = 'application/json';
        jsonScript.innerHTML = JSON.stringify(result);
        document.body.appendChild(jsonScript);
      });
      await fs.writeFile(
        `${packagePath}/index.html`,
        document.documentElement.outerHTML
      );
      await generateExport(document);
    } catch (e) {
      errorMessage = 'Could not append JSON data to HTML file.';
      printMessage(MessageTypes.ERROR, { e: <Error>e, log: errorMessage });
    }
  }

  function exportJsonBundle(): IResults {
    return resultsStorage.getAllResults();
  }

  async function calculateAverage(): Promise<IResults | null> {
    try {
      const results = resultsStorage.getAllResults();
      const flows = Object.keys(results);

      flows.forEach(async (flowKey, i) => {
        const sumLogs: {
          actualDuration: number;
          baseDuration: number;
          commitTime: number;
          id: string;
          interactions: {};
          phase: string;
          startTime: number;
        }[] = [];

        let sumNumberOfInteractions = 0;

        const flowResults = results[flowKey];

        flowResults.forEach((result) => {
          const { logs, numberOfInteractions } = result;

          for (const [index, log] of logs.entries()) {
            if (typeof sumLogs[index] !== 'object' || sumLogs[index] === null)
              sumLogs[index] = {
                actualDuration: 0,
                baseDuration: 0,
                commitTime: 0,
                id: '',
                interactions: new Set<Interaction>(),
                phase: '',
                startTime: 0,
              };

            sumLogs[index].actualDuration += log.actualDuration;
            sumLogs[index].baseDuration += log.baseDuration;
            sumLogs[index].commitTime += log.commitTime;
            sumLogs[index].startTime += log.startTime;
            if (!sumLogs[index].id) sumLogs[index].id = log.id;
            if (!sumLogs[index].phase) sumLogs[index].phase = log.phase;
          }

          sumNumberOfInteractions += numberOfInteractions;
        });

        const averageData: AutomationResult = {
          logs: sumLogs.map((log) => ({
            actualDuration: log.actualDuration / averageOf,
            baseDuration: log.baseDuration / averageOf,
            commitTime: log.commitTime / averageOf,
            id: log.id,
            interactions: log.interactions as Set<Interaction>,
            phase: log.phase,
            startTime: log.startTime / averageOf,
          })),
          numberOfInteractions: sumNumberOfInteractions / averageOf,
          id: getFileName(flowKey),
        };

        resultsStorage.removeResultsByKey(flowKey);
        resultsStorage.appendResult(`average-${flowKey}`, averageData);

        if (averageOf === automationCount && i === flows.length - 1) {
          return await exportResults();
        }

        return averageData;
      });

      return null;
    } catch (e) {
      errorMessage = 'An error occurred while calculating averages.';
      printMessage(MessageTypes.ERROR, { e: <Error>e, log: errorMessage });
      return null;
    }
  }

  async function setIsLoggingEnabled(isLoggingEnabled: boolean): Promise<void> {
    await page.evaluate((isEnabled) => {
      window.isProfilingEnabled = isEnabled;
    }, isLoggingEnabled);
  }

  async function collectLogs({
    label,
    numberOfInteractions = 0,
  }: {
    label: string;
    numberOfInteractions?: number;
  }) {
    if (label !== MOUNT || (label === MOUNT && includeMount)) {
      const logs = await page.evaluate(() => window.profiler);

      if (logs?.length === 0) return false;

      resultsStorage.appendResult(label, {
        logs,
        numberOfInteractions,
        id: getFileName(label),
      });
    }
    await page.evaluate(() => {
      window.profiler = [];
      window.isProfilingEnabled = true;
    });
    return true;
  }

  async function generateExport(document: Document) {
    document.querySelector('#export')?.remove();
    try {
      await fs.writeFile(
        `${packagePath}/export.html`,
        minify(document.documentElement.outerHTML, {
          collapseBooleanAttributes: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true,
          removeAttributeQuotes: true,
        })
      );
    } catch (e) {
      errorMessage = 'An error occurred while generating a new export file.';
      printMessage(MessageTypes.ERROR, { e: <Error>e, log: errorMessage });
    }
  }

  async function handleActions(actions: string[]) {
    for (const action of actions) {
      const [actionType, ...selector] = action.split(' ');

      if (Object.values(Actions).includes(actionType as Actions)) {
        const selectorStr = selector.join(' ');

        printMessage(MessageTypes.NOTICE, {
          log: `${actionType}: ${selectorStr}`,
        });

        switch (actionType) {
          case Actions.CLICK:
            await page.click(selectorStr);
            break;
          case Actions.FOCUS:
            await page.focus(selectorStr);
            break;
          case Actions.HOVER:
            await page.hover(selectorStr);
            break;
          case Actions.GOTO:
            await page.goto(selectorStr);
            break;
          case Actions.WAIT:
            await page.waitForTimeout(parseInt(selectorStr));
            break;
        }
      } else {
        errorMessage = 'One or more action types provided was not valid.';
        throw printMessage(MessageTypes.ERROR, { log: errorMessage });
      }
    }
  }

  async function readAutomationFile() {
    let flows;

    try {
      flows = <Flows>(
        yaml.load(await fs.readFile(`${cwd}/react.automation.yml`, 'utf8'))
      );
      return flows;
    } catch {
      flows = <Flows>(
        yaml.load(await fs.readFile(`${cwd}/react.automation.yaml`, 'utf8'))
      );

      return flows;
    }
  }

  async function runFlows() {
    if (scenarios?.length) {
      printMessage(MessageTypes.NOTICE, {
        log: `Running programmatic flows.\n`,
      });
      await runScenarios(scenarios);
    } else {
      printMessage(MessageTypes.NOTICE, {
        log: `Running YAML flows.\n`,
      });
      await runYAMLFlows();
    }
  }

  async function runScenarios(scenarios: Scenario[]): Promise<void> {
    try {
      let attempts = 0;

      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];

        if (scenario.shouldSkip) {
          printMessage(MessageTypes.NOTICE, {
            log: `Scenario "${scenario.id}": skipped`,
          });
          continue;
        }

        if (i > 0) {
          page = await initPage();
        }
        await launchWithUrl();

        printMessage(MessageTypes.NOTICE, {
          log: `Scenario "${scenario.id}": attempt #${attempts + 1}`,
        });

        await setIsLoggingEnabled(false);
        await scenario.onBefore?.(page);
        await setIsLoggingEnabled(true);

        await scenario.onProfile(page);

        const success = await collectLogs({
          label: scenario.id,
          numberOfInteractions: 0, // TODO
        });
        if (!success) {
          if (attempts++ < 3) i -= 1;
          else
            printMessage(MessageTypes.NOTICE, {
              log: `Automation flow "${scenario.id}" did not produce any renders.\n`,
            });
        }

        if (!page.isClosed()) {
          page.close();
        }
      }
    } catch (error) {
      handleRunFlowsError(error);
    }
  }

  async function runYAMLFlows() {
    try {
      const flows = await readAutomationFile();

      if (!flows) {
        return;
      }

      const keys = Object.keys(flows);
      let attempts = 0;
      for (let i = 0; i < keys.length; i++) {
        const actions = flows[keys[i]];
        await handleActions(actions);

        const success = await collectLogs({
          label: keys[i],
          numberOfInteractions: actions.length,
        });
        if (!success) {
          if (attempts++ < 3) i -= 1;
          else
            printMessage(MessageTypes.NOTICE, {
              log: `Automation flow "${keys[i]}" did not produce any renders.\n`,
            });
        }
      }
    } catch (error) {
      handleRunFlowsError(error);
    }
  }

  function handleRunFlowsError(error: unknown) {
    const isErrorObjectEmpty = Object.keys(<Error>error).length === 0;
    const description =
      isErrorObjectEmpty &&
      ` This was likely caused by one of these issues:
      - The react.automation YAML file could not be found at the root of your repo.
      - The react.automation file is using a selector that does not exist.`;
    errorMessage = `An error occurred while trying to run automation flows.${
      description ? description : ''
    }`;
    printMessage(MessageTypes.ERROR, {
      e: error ? <Error>error : new Error('Unspecified error'),
      log: errorMessage,
    });
  }

  async function startServer() {
    const app = express();
    app.use(express.static(packagePath));
    app.get('/', (_, res) => res.sendFile(`${packagePath}/index.html`));
    app.listen(serverPort);
  }

  if (!scenarios) {
    await launchWithUrl();
  }

  await collectLogs({ label: MOUNT });
  await runFlows();
  await browser.close();

  let results: IResults | null = {};

  if (averageOf > 1 && automationCount === averageOf) {
    results = await calculateAverage();
  } else if (averageOf === 1) {
    results = await exportResults();
  }

  if (
    !isServerReady &&
    automationCount === averageOf &&
    output === OutputType.CHART
  )
    await startServer();

  if (errorMessage) {
    printMessage(MessageTypes.ERROR, {
      log: 'Automation could not complete because of the above errors.',
    });
    throw new Error(errorMessage);
  }

  return results;
}
