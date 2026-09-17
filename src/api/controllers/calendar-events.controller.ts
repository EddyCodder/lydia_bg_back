import { CalendarEventsService } from '@api/services/calendar-events.service';

export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  public async listEvents(query: Parameters<CalendarEventsService['listEvents']>[0]) {
    return this.calendarEventsService.listEvents(query);
  }

  public async createEvent(data: Parameters<CalendarEventsService['createEvent']>[0]) {
    return this.calendarEventsService.createEvent(data);
  }

  public async updateEvent(id: string, data: Parameters<CalendarEventsService['updateEvent']>[1]) {
    return this.calendarEventsService.updateEvent(id, data);
  }

  public async deleteEvent(id: string) {
    return this.calendarEventsService.deleteEvent(id);
  }
}
