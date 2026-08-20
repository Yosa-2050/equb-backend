import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Action, Command, Start, Update } from 'nestjs-telegraf';
import { Context, Markup, Scenes } from 'telegraf';
import { EqubService } from '../equb/equb.service';
import { UsersService } from '../users/users.service';
import { UserLanguage } from '../users/entities/user.entity';
import { TranslationService } from '../i18n/translation.service';

type SceneCapableContext = Context & Scenes.SceneContext;

@Injectable()
@Update()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly equbService: EqubService,
    private readonly configService: ConfigService,
    private readonly translationService: TranslationService,
  ) {}

  @Start()
  async onStart(ctx: Context & { startPayload?: string }) {
    const from = ctx.from;
    this.logger.log(`/start received from telegramId=${from?.id ?? 'unknown'}, payload=${ctx.startPayload ?? '(none)'}`);
    if (!from) return;

    // Telegram's language_code (e.g. "am", "am-ET") only sets the default
    // for brand-new users; it never overrides a language they picked later.
    const language = from.language_code?.toLowerCase().includes('am')
      ? UserLanguage.AM
      : UserLanguage.EN;

    const user = await this.usersService.findOrCreateByTelegramId({
      telegramId: String(from.id),
      firstName: from.first_name,
      telegramUsername: from.username,
      language,
    });

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    this.logger.log(`MINI_APP_URL=${miniAppUrl || '(not set)'}`);
    const inviteCode = ctx.startPayload;
    const openApp = this.translationService.t(user.language, 'button.openApp');

    if (inviteCode) {
      const equb = await this.equbService.findByInviteCode(inviteCode);
      const sent = await ctx.reply(
        this.translationService.t(user.language, 'welcome.invite', {
          equbName: equb.name,
        }),
        miniAppUrl
          ? Markup.inlineKeyboard([
              Markup.button.webApp(
                openApp,
                `${miniAppUrl}/join?code=${encodeURIComponent(inviteCode)}`,
              ),
            ])
          : undefined,
      );
      await this.pinSilently(ctx, sent.message_id);
      return;
    }

    const sent = await ctx.reply(
      this.translationService.t(user.language, 'welcome.generic'),
      miniAppUrl
        ? Markup.inlineKeyboard([Markup.button.webApp(openApp, miniAppUrl)])
        : undefined,
    );
    await this.pinSilently(ctx, sent.message_id);
  }

  
  private async pinSilently(ctx: Context, messageId: number): Promise<void> {
    try {
      await ctx.pinChatMessage(messageId, { disable_notification: true });
    } catch {
      // Best-effort; e.g. nothing to do if pinning isn't permitted here.
    }
  }

  @Command('myinfo')
  async onMyInfo(ctx: SceneCapableContext) {
    await ctx.scene.enter('member-info');
  }

  @Action(/^fillinfo:(.+)$/)
  async onFillInfo(ctx: SceneCapableContext & { match: RegExpExecArray }) {
    const equbId = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.scene.enter('member-info', { equbId });
  }
}
