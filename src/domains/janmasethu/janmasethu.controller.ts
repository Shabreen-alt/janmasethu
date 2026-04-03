import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { JanmasethuRepository, Lead, Patient, Appointment } from '../../infrastructure/repositories/janmasethu.repository';
import { JanmasethuHandler } from './janmasethu.handler';
import { Roles } from '../../infrastructure/auth/roles.decorator';
import { RolesGuard } from '../../infrastructure/auth/roles.guard';
import { User, UserMetadata } from '../../infrastructure/auth/user.decorator';

@Controller('api')
@UseGuards(RolesGuard)
export class JanmasethuController {
  constructor(
    private readonly repository: JanmasethuRepository,
    private readonly handler: JanmasethuHandler
  ) {}

  @Post('leads')
  @Roles('DOCTOR', 'ADMIN')
  async createLead(@Body() lead: Lead, @User() user: UserMetadata) {
    return this.repository.createLead(lead, user.id);
  }

  @Get('leads')
  @Roles('DOCTOR', 'ADMIN')
  async getLeads(@User() user: UserMetadata) {
    return this.repository.getLeads(user.id);
  }

  @Post('patients')
  @Roles('DOCTOR', 'ADMIN')
  async createPatient(@Body() patient: Patient, @User() user: UserMetadata) {
    return this.repository.createPatient(patient, user.id);
  }

  @Get('patients')
  @Roles('DOCTOR', 'ADMIN')
  async getPatients(@User() user: UserMetadata) {
    return this.repository.getPatients(user.id);
  }

  @Post('appointments')
  @Roles('DOCTOR', 'ADMIN')
  async createAppointment(@Body() appointment: Appointment, @User() user: UserMetadata) {
    return this.repository.createAppointment(appointment, user.id);
  }

  @Get('appointments')
  @Roles('DOCTOR', 'ADMIN')
  async getAppointments(@User() user: UserMetadata) {
    return this.repository.getAppointments(user.id);
  }

  @Post('threads')
  @Roles('DOCTOR', 'ADMIN')
  async createThread(@Body() thread: any, @User() user: UserMetadata) {
    return this.repository.createThread(thread, user.id);
  }

  @Get('threads')
  @Roles('DOCTOR', 'ADMIN')
  async getThreads(@User() user: UserMetadata) {
    return this.repository.getThreads(user.id);
  }

  // ==========================================
  // CHAT & ORCHESTRATION
  // ==========================================
  @Post('messages')
  async handleMessage(
    @Body() body: { threadId: string; content: string; senderId: string },
    @User() user: UserMetadata
  ) {
    const { threadId, content, senderId } = body;
    return this.handler.handleIncomingMessage(threadId, content, senderId, user.id);
  }

  @Get('messages/:threadId')
  @Roles('DOCTOR', 'ADMIN')
  async getMessages(@Param('threadId') threadId: string, @User() user: UserMetadata) {
    return this.repository.getMessagesByThread(threadId, user.id);
  }

  @Post('threads/status')
  @Roles('DOCTOR', 'ADMIN')
  async updateStatus(
    @Body() body: { threadId: string; status: string; severity: string },
    @User() user: UserMetadata
  ) {
    const { threadId, status, severity } = body;
    return this.handler.updateThreadStatus(threadId, status, severity, user.id);
  }
}
