import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EqubModule } from '../equb/equb.module';
import { EqubSchedulerService } from '../equb/equb-scheduler.service';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { Equb } from '../equb/entities/equb.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { I18nModule } from '../i18n/i18n.module';
import { UsersModule } from '../users/users.module';
import { Payment } from './entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, EqubMember, Equb]),
    EqubModule,
    NotificationsModule,
    CloudinaryModule,
    I18nModule,
    UsersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, EqubSchedulerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
