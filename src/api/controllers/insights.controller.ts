import { InsightsService } from '@api/services/insights.service';

export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  public async getPersonalInsights(query: Parameters<InsightsService['getPersonalInsights']>[0]) {
    return this.insightsService.getPersonalInsights(query);
  }
}
