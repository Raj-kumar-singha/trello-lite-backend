import nodemailer from "nodemailer";

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendTaskAssignmentEmail = async (
  toEmail,
  taskTitle,
  projectName,
  assignerName
) => {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.log("Email service not configured. Skipping email notification.");
      return;
    }

    await transporter.sendMail({
      from: `"Team Task Manager" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `New Task Assigned: ${taskTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3B82F6;">You've been assigned a new task!</h2>
          <p>Hello,</p>
          <p><strong>${assignerName}</strong> has assigned you a new task in the project <strong>${projectName}</strong>.</p>
          <div style="background-color: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${taskTitle}</h3>
          </div>
          <p>Please log in to your account to view the task details and get started.</p>
          <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">Best regards,<br>Team Task Manager</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
