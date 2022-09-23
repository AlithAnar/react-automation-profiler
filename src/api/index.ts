import automate, { AutomationProps } from '../automation/automation';
import path from 'path';
import { AutomationResultsStorage } from '../automation/AutomationResultsStorage';
import { IResults, APIOptions, OutputType } from '../interfaces';
import { resolve } from 'path';

export class AutomationAPI {
  static async run({
    averageOf = 1,
    includeMount = false,
    page,
    preloadFilePath,
    cookies,
    scenarios,
    headless = true,
    browserArgs = [],
  }: APIOptions): Promise<IResults> {
    let results: IResults = {};
    const scriptPath = resolve('./lib/api/index.js');
    const packagePath = `${scriptPath.slice(0, scriptPath.lastIndexOf('/'))}`;
    const resultsStorage = new AutomationResultsStorage();

    for (
      let automationCount = 1;
      automationCount <= averageOf;
      automationCount++
    ) {
      const props: AutomationProps = {
        automationCount,
        preloadFilePath,
        averageOf,
        cwd: path.resolve(),
        includeMount,
        isServerReady: false,
        packagePath,
        serverPort: 0,
        url: page,
        headless,
        browserArgs,
        cookies,
        output: OutputType.JSON,
        scenarios,
      };

      const automationResult = await automate(props, resultsStorage);

      if (automationResult) {
        results = automationResult;
      }
    }

    return results;
  }
}
