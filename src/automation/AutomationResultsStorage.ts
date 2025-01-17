import { AutomationResult, IResults } from '../interfaces';

export interface IAutomationResultsStorage {
  appendResult(flowKey: string, result: AutomationResult): void;
  removeResultsByKey(flowKey: string): void;
  getAllResults(): IResults;
}

export class AutomationResultsStorage implements IAutomationResultsStorage {
  private storage: IResults = {};

  appendResult(flowKey: string, result: AutomationResult): void {
    if (!this.storage[flowKey]) {
      this.storage[flowKey] = [result];
    } else {
      this.storage[flowKey].push(result);
    }
  }

  removeResultsByKey(flowKey: string): void {
    delete this.storage[flowKey];
  }

  getAllResults(): IResults {
    return this.storage;
  }
}
