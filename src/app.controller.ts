import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/current-user.decorator';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Public so uptime pingers (keeping the free-tier host from sleeping) get
  // a clean 200 instead of a 401.
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
