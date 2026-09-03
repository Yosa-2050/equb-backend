import { Module } from '@nestjs/common';
import { EqubModule } from '../equb/equb.module';
import { UsersModule } from '../users/users.module';
import { I18nModule } from '../i18n/i18n.module';
import { PaymentsModule } from '../payments/payments.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { MemberInfoWizard } from './member-info.wizard';
import { ReceiptUploadWizard } from './receipt-upload.wizard';
import { TelegramService } from './telegram.service';

@Module({
  imports: [UsersModule, EqubModule, I18nModule, PaymentsModule, CloudinaryModule],
  providers: [TelegramService, MemberInfoWizard, ReceiptUploadWizard],
})
export class TelegramModule {}
