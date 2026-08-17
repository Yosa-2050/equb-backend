import { Injectable } from '@nestjs/common';
import { Ctx, Wizard, WizardStep } from 'nestjs-telegraf';
import { Scenes } from 'telegraf';
import { EqubService } from '../equb/equb.service';
import { UsersService } from '../users/users.service';

interface WizardState {
  equbId?: string;
  phone?: string;
  accountProvider?: string;
  accountNumber?: string;
}

type MemberInfoContext = Scenes.WizardContext;

function textOf(ctx: MemberInfoContext): string | null {
  const message = ctx.message as { text?: string } | undefined;
  return message?.text?.trim() || null;
}

// Collects phone + payout account details right after a member joins an
// equb, so every member's info is on file before their payout month comes
// up. Entered via the "Add my payout info" button sent on join, or /myinfo.
@Injectable()
@Wizard('member-info')
export class MemberInfoWizard {
  constructor(
    private readonly usersService: UsersService,
    private readonly equbService: EqubService,
  ) {}

  @WizardStep(1)
  async askPhone(@Ctx() ctx: MemberInfoContext) {
    await ctx.reply(
      "Let's set up your payout info 📋\nWhat's your phone number?",
    );
    ctx.wizard.next();
  }

  @WizardStep(2)
  async askProvider(@Ctx() ctx: MemberInfoContext) {
    const text = textOf(ctx);
    if (!text) {
      await ctx.reply('Please send your phone number as text.');
      return;
    }
    (ctx.wizard.state as WizardState).phone = text;
    await ctx.reply('Which bank or mobile money provider do you use? (e.g. Telebirr, CBE)');
    ctx.wizard.next();
  }

  @WizardStep(3)
  async askAccountNumber(@Ctx() ctx: MemberInfoContext) {
    const text = textOf(ctx);
    if (!text) {
      await ctx.reply('Please send the provider name as text.');
      return;
    }
    (ctx.wizard.state as WizardState).accountProvider = text;
    await ctx.reply('What is your account number?');
    ctx.wizard.next();
  }

  @WizardStep(4)
  async askHolderName(@Ctx() ctx: MemberInfoContext) {
    const text = textOf(ctx);
    if (!text) {
      await ctx.reply('Please send your account number as text.');
      return;
    }
    (ctx.wizard.state as WizardState).accountNumber = text;
    await ctx.reply('What name is on that account? (account holder name)');
    ctx.wizard.next();
  }

  @WizardStep(5)
  async save(@Ctx() ctx: MemberInfoContext) {
    const text = textOf(ctx);
    if (!text) {
      await ctx.reply('Please send the account holder name as text.');
      return;
    }
    const state = ctx.wizard.state as WizardState;
    const from = ctx.from;
    if (!from) {
      return ctx.scene.leave();
    }

    const user = await this.usersService.findOrCreateByTelegramId({
      telegramId: String(from.id),
      firstName: from.first_name,
      telegramUsername: from.username,
    });

    let equbId = state.equbId;
    if (!equbId) {
      // No specific equb context (e.g. entered via /myinfo): default to
      // their most recently joined one.
      const equbs = await this.equbService.findMine(user.id);
      equbId = equbs[0]?.id;
    }

    if (!equbId) {
      await ctx.reply(
        "You haven't joined an equb yet, so there's nothing to save this to. Join one first, then send /myinfo.",
      );
      return ctx.scene.leave();
    }

    await this.equbService.updateMyMembership(equbId, user.id, {
      phone: state.phone,
      accountProvider: state.accountProvider,
      accountNumber: state.accountNumber,
      accountHolderName: text,
    });

    await ctx.reply(
      "✅ Saved! You're all set — this is where your payout will be sent when your month comes up.",
    );
    return ctx.scene.leave();
  }
}
