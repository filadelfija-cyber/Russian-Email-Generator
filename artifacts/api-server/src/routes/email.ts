import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import { SendEmailBody } from "@workspace/api-zod";

const router: IRouter = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/email/send", async (req, res) => {
  const parsed = SendEmailBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Enter valid SMTP settings, recipients, subject, and body.",
    });
    return;
  }

  const { smtp, recipients, subject, body } = parsed.data;
  const hasValidPort = Number.isInteger(smtp.port) && smtp.port >= 1 && smtp.port <= 65535;
  const hasValidEmails =
    emailPattern.test(smtp.fromEmail) && recipients.every((recipient) => emailPattern.test(recipient));

  if (!hasValidPort || !hasValidEmails) {
    res.status(400).json({
      message: "Check the SMTP port and email addresses.",
    });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });

    const result = await transporter.sendMail({
      from: smtp.fromEmail,
      bcc: recipients,
      subject,
      text: body,
    });

    res.json({
      sent: recipients.length,
      messageId: result.messageId,
    });
  } catch (error) {
    req.log.error({ err: error }, "SMTP email delivery failed");
    res.status(502).json({
      message: "The SMTP server could not send this email. Check the server settings and credentials.",
    });
  }
});

export default router;