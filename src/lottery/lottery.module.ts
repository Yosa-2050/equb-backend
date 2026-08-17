import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EqubModule } from '../equb/equb.module';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { LotteryController } from './lottery.controller';
import { LotteryGateway } from './lottery.gateway';
import { LotteryService } from './lottery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EqubMember]),
    EqubModule,
    NotificationsModule,
  ],
  controllers: [LotteryController],
  providers: [LotteryService, LotteryGateway],
  exports: [LotteryService],
})
export class LotteryModule {}
