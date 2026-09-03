import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/telegram-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: 'List notifications for the current user (paginated, filterable)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'read', required: false, example: false })
  @ApiQuery({ name: 'equbId', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date, inclusive' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date, inclusive' })
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('read') read?: string,
    @Query('equbId') equbId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.notificationsService.findAllForUser(user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      read: read !== undefined ? read === 'true' : undefined,
      equbId,
      from,
      to,
    });
  }

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
