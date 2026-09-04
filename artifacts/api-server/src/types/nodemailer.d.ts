declare module "nodemailer" {
  type TransportOptions = {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  };

  type MessageOptions = {
    from: string;
    bcc: string[];
    subject: string;
    text: string;
  };

  type SendResult = {
    messageId: string;
  };

  type Transporter = {
    sendMail(message: MessageOptions): Promise<SendResult>;
  };

  const nodemailer: {
    createTransport(options: TransportOptions): Transporter;
  };

  export default nodemailer;
}