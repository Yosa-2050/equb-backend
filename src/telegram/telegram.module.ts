import { Module } from '@nestjs/common';
import { EqubModule } from '../equb/equb.module';
import { UsersModule } from '../users/users.module';
import { I18nModule } from '../i18n/i18n.module';
import { MemberInfoWizard } from './member-info.wizard';
import { TelegramService } from './telegram.service';

@Module({
  imports: [UsersModule, EqubModule, I18nModule],
  providers: [TelegramService, MemberInfoWizard],
})
export class TelegramModule {}
