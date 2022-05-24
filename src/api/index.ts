import automate from '../automation/automation.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { AutomationResultsStorage } from '../automation/AutomationResultsStorage.js';
import { APIOptions, IResults, OutputType } from 'types';

export class AutomationAPI {
  static async run({
    averageOf = 1,
    includeMount = false,
    page,
    headless = true,
  }: APIOptions): Promise<IResults> {
    let results: IResults = {};
    const scriptPath = fileURLToPath(import.meta.url);
    const packagePath = `${scriptPath.slice(0, scriptPath.lastIndexOf('/'))}`;
    const resultsStorage = new AutomationResultsStorage();

    for (
      let automationCount = 1;
      automationCount <= averageOf;
      automationCount++
    ) {
      const props = {
        automationCount,
        averageOf,
        cwd: path.resolve(),
        includeMount,
        isServerReady: false,
        packagePath,
        serverPort: 0,
        url: page,
        headless,
        output: OutputType.JSON,
      };

      const automationResult = await automate(props, resultsStorage);

      if (automationResult) {
        results = automationResult;
      }
    }

    return results;
  }
}
