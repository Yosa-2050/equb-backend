import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/telegram-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@Controller('equb/:equbId')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiOperation({
    summary: 'Get the state of one equb month',
    description:
      'Returns who receives the pot for that month and one payment row per other member.',
  })
  @Get('month/:month')
  getMonth(
    @Param('equbId') equbId: string,
    @Param('month', ParseIntPipe) month: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.getMonth(equbId, month, user.id);
  }

  @ApiOperation({ summary: 'Submit this month contribution (member)' })
  @Post('payments')
  submit(
    @Param('equbId') equbId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.submit(equbId, user.id, dto);
  }

  @ApiOperation({ summary: 'Approve a payment (month recipient only)' })
  @Post('payments/:paymentId/approve')
  approve(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.approve(paymentId, user.id);
  }

  @ApiOperation({ summary: 'Reject a payment (month recipient only)' })
  @Post('payments/:paymentId/reject')
  reject(
    @Param('paymentId') paymentId: string,
    @Body() dto: RejectPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.reject(paymentId, user.id, dto.reason);
  }

  @ApiOperation({
    summary: 'Submit this month contribution with a receipt photo (member)',
    description:
      "Uploads the receipt image to Cloudinary and saves its URL on the member's payment for this month.",
  })
  @ApiConsumes('multipart/form-data')
  @Post('payments/upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadReceipt(
    @Param('equbId') equbId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('amount') amount: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.submitWithReceipt(
      equbId,
      user.id,
      file,
      amount ? Number(amount) : undefined,
    );
  }

  @ApiOperation({
    summary: 'Remind unpaid members to pay this month (admin only)',
    description:
      "Notifies every member who hasn't paid this month's contribution yet, with this month's recipient's account details.",
  })
  @Post('payments/remind')
  remind(@Param('equbId') equbId: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.remind(equbId, user.id);
  }
}
