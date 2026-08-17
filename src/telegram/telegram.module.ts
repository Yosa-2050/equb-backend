import { Module } from '@nestjs/common';
import { EqubModule } from '../equb/equb.module';
import { UsersModule } from '../users/users.module';
import { MemberInfoWizard } from './member-info.wizard';
import { TelegramService } from './telegram.service';

@Module({
  imports: [UsersModule, EqubModule],
  providers: [TelegramService, MemberInfoWizard],
})
export class TelegramModule {}
