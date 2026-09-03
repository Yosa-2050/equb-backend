import { Injectable } from '@nestjs/common';
import { Ctx, Wizard, WizardStep } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { PaymentsService } from '../payments/payments.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from '../users/users.service';
import { UserLanguage } from '../users/entities/user.entity';
import { TranslationService } from '../i18n/translation.service';

interface WizardState {
  paymentId: string;
  equbName?: string;
  enteredAt?: number;
}

type ReceiptUploadContext = Scenes.WizardContext;

const TIMEOUT_MS = 5 * 60 * 1000;

// Lets a member upload their payment receipt photo directly in the
// Telegram chat — a faster alternative to the Mini App upload. Entered via
// the payment reminder DM's "Upload Here" button.
@Injectable()
@Wizard('receipt-upload')
export class ReceiptUploadWizard {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService,
  ) {}

  private async languageOf(
    ctx: ReceiptUploadContext,
  ): Promise<UserLanguage | undefined> {
    const telegramId = ctx.from ? String(ctx.from.id) : undefined;
    if (!telegramId) return undefined;
    const user = await this.usersService.findByTelegramId(telegramId);
    return user?.language;
  }

  @WizardStep(1)
  async askPhoto(@Ctx() ctx: ReceiptUploadContext) {
    const state = ctx.wizard.state as WizardState;
    const from = ctx.from;
    const lang = await this.languageOf(ctx);
    if (!from || !state.paymentId) {
      return ctx.scene.leave();
    }

    const info = await this.paymentsService.getPaymentForBotUpload(
      state.paymentId,
      String(from.id),
    );
    if (!info) {
      await ctx.reply(this.translationService.t(lang, 'receipt.notFound'));
      return ctx.scene.leave();
    }

    state.equbName = info.equbName;
    state.enteredAt = Date.now();
    await ctx.reply(
      this.translationService.t(lang, 'receipt.askPhoto', {
        equbName: info.equbName,
      }),
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  async handlePhoto(@Ctx() ctx: ReceiptUploadContext) {
    const state = ctx.wizard.state as WizardState;
    const lang = await this.languageOf(ctx);

    if (!state.enteredAt || Date.now() - state.enteredAt > TIMEOUT_MS) {
      await ctx.reply(this.translationService.t(lang, 'receipt.timedOut'));
      return ctx.scene.leave();
    }

    const message = ctx.message as { photo?: { file_id: string }[] } | undefined;
    const photos = message?.photo;
    if (!photos || photos.length === 0) {
      await ctx.reply(this.translationService.t(lang, 'receipt.askPhotoAgain'));
      return;
    }

    try {
      // Telegram returns multiple resolutions; the last one is the largest.
      const fileId = photos[photos.length - 1].file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const res = await fetch(fileLink.href);
      const buffer = Buffer.from(await res.arrayBuffer());
      const receiptImageUrl = await this.cloudinaryService.uploadBuffer(buffer);
      await this.paymentsService.attachReceiptFromBot(state.paymentId, receiptImageUrl);
      await ctx.reply(this.translationService.t(lang, 'receipt.success'));
    } catch {
      await ctx.reply(this.translationService.t(lang, 'receipt.uploadFailed'));
    }
    return ctx.scene.leave();
  }
}
