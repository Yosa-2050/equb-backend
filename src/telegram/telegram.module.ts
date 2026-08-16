import { Module } from '@nestjs/common';
import { EqubModule } from '../equb/equb.module';
import { UsersModule } from '../users/users.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [UsersModule, EqubModule],
  providers: [TelegramService],
})
export class TelegramModule {}
