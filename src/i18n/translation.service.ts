import { Injectable } from '@nestjs/common';
import { UserLanguage } from '../users/entities/user.entity';
import en from './locales/en.json';
import am from './locales/am.json';

type Dictionary = Record<string, string>;
type Vars = Record<string, string | number>;

@Injectable()
export class TranslationService {
  private readonly dictionaries: Record<UserLanguage, Dictionary> = {
    [UserLanguage.EN]: en,
    [UserLanguage.AM]: am,
  };

  t(lang: UserLanguage | null | undefined, key: string, vars?: Vars): string {
    const dict = this.dictionaries[lang ?? UserLanguage.AM] ?? this.dictionaries[UserLanguage.AM];
    let template = dict[key] ?? this.dictionaries[UserLanguage.EN][key] ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        template = template.split(`{${name}}`).join(String(value));
      }
    }
    return template;
  }

  // Maps an equb's frequency to a translated lowercase period word
  // ("day"/"week"/"month"), for interpolating into other messages.
  periodWord(lang: UserLanguage | null | undefined, frequency: string): string {
    const key =
      frequency === 'daily'
        ? 'period.day'
        : frequency === 'weekly'
          ? 'period.week'
          : 'period.month';
    return this.t(lang, key);
  }
}
