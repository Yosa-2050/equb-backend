import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollabGroup } from './entities/collab-group.entity';
import { EqubMember } from './entities/equb-member.entity';
import { Equb } from './entities/equb.entity';
import { EqubController } from './equb.controller';
import { EqubService } from './equb.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Equb, EqubMember, Payment, User, CollabGroup]),
    NotificationsModule,
  ],
  controllers: [EqubController],
  providers: [EqubService],
  exports: [EqubService],
})
export class EqubModule {}
