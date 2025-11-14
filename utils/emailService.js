import nodemailer from "nodemailer";

const createTransporter = () => {
  // Brevo (formerly Sendinblue) requires EMAIL_USER (SMTP login) and EMAIL_PASS (SMTP key)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports (587 uses TLS)
    auth: {
      user: process.env.EMAIL_USER, // Your Brevo SMTP login email
      pass: process.env.EMAIL_PASS, // Your Brevo SMTP key (not password)
    },
  });
};

export const sendTaskAssignmentEmail = async (
  toEmail,
  taskTitle,
  projectName,
  assignerName
) => {
  const logPrefix = `[Email Service]`;
  const timestamp = new Date().toISOString();

  try {
    // Check if email service is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(
        `${logPrefix} [${timestamp}] ⚠️  Email service not configured. EMAIL_USER or EMAIL_PASS missing. Skipping email notification.`
      );
      console.log(
        `${logPrefix} [${timestamp}] 📧 Would have sent to: ${toEmail} | Task: ${taskTitle}`
      );
      return { success: false, reason: 'Email service not configured' };
    }

    const transporter = createTransporter();
    if (!transporter) {
      console.log(
        `${logPrefix} [${timestamp}] ⚠️  Failed to create email transporter. Skipping email notification.`
      );
      return { success: false, reason: 'Failed to create transporter' };
    }

    // Use EMAIL_FROM if provided, otherwise use EMAIL_USER
    const fromEmail = process.env.EMAIL_FROM || "itjtestmail@gmail.com";

    console.log(
      `${logPrefix} [${timestamp}] 📤 Attempting to send email...`
    );
    console.log(
      `${logPrefix} [${timestamp}]    From: ${fromEmail}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    To: ${toEmail}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    Subject: New Task Assigned: ${taskTitle}`
    );

    const mailOptions = {
      from: `"Team Task Manager" <${fromEmail}>`,
      to: toEmail,
      subject: `New Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3B82F6; margin-bottom: 20px;">You've been assigned a new task!</h2>
          <p style="color: #374151; line-height: 1.6;">Hello,</p>
          <p style="color: #374151; line-height: 1.6;">
            <strong>${assignerName}</strong> has assigned you a new task in the project <strong>${projectName}</strong>.
          </p>
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3B82F6;">
            <h3 style="margin-top: 0; color: #1F2937;">${taskTitle}</h3>
          </div>
          <p style="color: #374151; line-height: 1.6;">
            Please log in to your account to view the task details and get started.
          </p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px; margin: 0;">
              Best regards,<br>
              <strong>Team Task Manager</strong>
            </p>
          </div>
        </div>
      `,
    };

    // Set timeout for email sending (8 seconds max)
    const sendEmailWithTimeout = () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Email sending timeout after 8 seconds'));
        }, 8000);
        
        transporter.sendMail(mailOptions)
          .then((info) => {
            clearTimeout(timeout);
            resolve(info);
          })
          .catch((error) => {
            clearTimeout(timeout);
            reject(error);
          });
      });
    };

    const info = await sendEmailWithTimeout();

    console.log(
      `${logPrefix} [${timestamp}] ✅ Email sent successfully!`
    );
    console.log(
      `${logPrefix} [${timestamp}]    Message ID: ${info.messageId}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    To: ${toEmail}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    Task: ${taskTitle}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    Project: ${projectName}`
    );
    console.log(
      `${logPrefix} [${timestamp}]    Assigned by: ${assignerName}`
    );

    return { 
      success: true, 
      messageId: info.messageId,
      to: toEmail,
      taskTitle,
      projectName,
      assignerName
    };
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'NO_CODE';
    
    console.error(
      `${logPrefix} [${timestamp}] ❌ Failed to send email!`
    );
    console.error(
      `${logPrefix} [${timestamp}]    Error Code: ${errorCode}`
    );
    console.error(
      `${logPrefix} [${timestamp}]    Error Message: ${errorMessage}`
    );
    console.error(
      `${logPrefix} [${timestamp}]    To: ${toEmail}`
    );
    console.error(
      `${logPrefix} [${timestamp}]    Task: ${taskTitle}`
    );
    
    // Log full error in development
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `${logPrefix} [${timestamp}]    Full Error:`,
        error
      );
    }

    return { 
      success: false, 
      error: errorMessage,
      errorCode,
      to: toEmail,
      taskTitle
    };
  }
};
