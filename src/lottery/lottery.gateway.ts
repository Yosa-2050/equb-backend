import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { EqubMember } from '../equb/entities/equb-member.entity';
import { DrawResultDto } from './lottery.service';

interface AuthedSocket extends Socket {
  data: { userId?: string };
}

// Live lottery: members who have the lottery page open join a room scoped
// to that equb, and see the admin's spins pushed to them as they happen.
@WebSocketGateway({
  cors: { origin: true },
  namespace: '/lottery',
})
export class LotteryGateway implements OnGatewayConnection {
  private readonly logger = new Logger(LotteryGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(EqubMember)
    private readonly equbMemberRepository: Repository<EqubMember>,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      client.data.userId = payload.sub;
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('joinEqubRoom')
  async onJoinEqubRoom(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() equbId: string,
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const member = await this.equbMemberRepository.findOne({
      where: { equbId, userId },
    });
    if (!member) return;

    await client.join(this.room(equbId));
    this.logger.debug(`user ${userId} joined lottery room for equb ${equbId}`);
  }

  broadcastSpin(equbId: string, result: DrawResultDto) {
    this.server.to(this.room(equbId)).emit('spin', result);
  }

  broadcastComplete(equbId: string, schedule: DrawResultDto[]) {
    this.server.to(this.room(equbId)).emit('complete', schedule);
  }

  private room(equbId: string): string {
    return `equb:${equbId}`;
  }
}
