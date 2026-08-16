import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Start, Update } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import { EqubService } from '../equb/equb.service';
import { UsersService } from '../users/users.service';

@Injectable()
@Update()
export class TelegramService {
  constructor(
    private readonly usersService: UsersService,
    private readonly equbService: EqubService,
    private readonly configService: ConfigService,
  ) {}

  @Start()
  async onStart(ctx: Context & { startPayload?: string }) {
    const from = ctx.from;
    if (!from) return;

    await this.usersService.findOrCreateByTelegramId({
      telegramId: String(from.id),
      firstName: from.first_name,
      telegramUsername: from.username,
    });

    const miniAppUrl = this.configService.get<string>('MINI_APP_URL', '');
    const inviteCode = ctx.startPayload;

    if (inviteCode) {
      // Registration only happens here. Joining is a deliberate action the
      // member takes inside the mini app, not something /start does for them.
      const equb = await this.equbService.findByInviteCode(inviteCode);
      await ctx.reply(
        `Welcome to Sebsabi | ሰብሳቢ! 🎉\nYou were invited to "${equb.name}". Open the app to join.`,
        miniAppUrl
          ? Markup.inlineKeyboard([
              Markup.button.webApp(
                'Open App',
                `${miniAppUrl}/join?code=${encodeURIComponent(inviteCode)}`,
              ),
            ])
          : undefined,
      );
      return;
    }

    await ctx.reply(
      `Welcome to Sebsabi | ሰብሳቢ! 🎉\nI am ready to help manage your Equb.`,
      miniAppUrl
        ? Markup.inlineKeyboard([Markup.button.webApp('Open App', miniAppUrl)])
        : undefined,
    );
  }
}
