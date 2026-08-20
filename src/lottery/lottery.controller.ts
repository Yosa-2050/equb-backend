import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/telegram-auth.guard';
import { EqubService } from '../equb/equb.service';
import { AdminPickDto } from './dto/admin-pick.dto';
import { LotteryService } from './lottery.service';

@ApiTags('lottery')
@ApiBearerAuth('access-token')
@Controller('equb/:equbId/lottery')
export class LotteryController {
  constructor(
    private readonly lotteryService: LotteryService,
    private readonly equbService: EqubService,
  ) {}

  @ApiOperation({ summary: 'Get current lottery/draw results for an equb' })
  @Get()
  getDraws(@Param('equbId') equbId: string) {
    return this.lotteryService.getDraws(equbId);
  }

  @ApiOperation({
    summary: 'Spin the wheel once (admin only)',
    description:
      'Randomly assigns one undrawn member the next free month. Returns the winning member.',
  })
  @Post('spin')
  async spin(@Param('equbId') equbId: string, @CurrentUser() user: AuthUser) {
    await this.equbService.assertAdmin(equbId, user.id);
    return this.lotteryService.spin(equbId);
  }

  @ApiOperation({
    summary: "Admin's pick for month 1 (admin only)",
    description:
      'Assigns a member or collab group to month 1 before the lottery draw begins.',
  })
  @Post('admin-pick')
  async adminPick(
    @Param('equbId') equbId: string,
    @Body() dto: AdminPickDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.equbService.assertAdmin(equbId, user.id);
    return this.lotteryService.adminPick(equbId, user.id, dto);
  }

  @ApiOperation({
    summary: 'Announce a live lottery session (admin only)',
    description:
      "Notifies every member with a link straight into this equb's lottery page.",
  })
  @Post('announce')
  async announce(
    @Param('equbId') equbId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.equbService.assertAdmin(equbId, user.id);
    return this.lotteryService.announce(equbId);
  }
}
