import { APIOptions } from '../api/Automation';
import { IResults } from '../automation/AutomationResultsStorage';

export class Automation {
  static run(options: APIOptions): Promise<IResults>;
}
