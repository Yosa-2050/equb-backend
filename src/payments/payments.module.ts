import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EqubModule } from '../equb/equb.module';
import { EqubSchedulerService } from '../equb/equb-scheduler.service';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { Equb } from '../equb/entities/equb.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, EqubMember, Equb]),
    EqubModule,
    NotificationsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, EqubSchedulerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
