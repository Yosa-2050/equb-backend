import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { Payment } from '../payments/entities/payment.entity';
import { UsersModule } from '../users/users.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [UsersModule, TypeOrmModule.forFeature([EqubMember, Payment])],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfilesModule {}
