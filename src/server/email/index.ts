import { Resend } from "resend";
import { env } from "~/env";

const resend = new Resend(env.RESEND_API_KEY);

interface VideoCompletedEmailParams {
  to: string;
  userName: string;
  videoFilename: string;
  downloadUrl: string;
  workspaceName: string;
  workspaceLogoUrl?: string | null;
  workspacePrimaryColor?: string;
}

/**
 * Send video completion notification email
 */
export async function sendVideoCompletedEmail(
  params: VideoCompletedEmailParams,
) {
  const {
    to,
    userName,
    videoFilename,
    downloadUrl,
    workspaceName,
    workspaceLogoUrl,
    workspacePrimaryColor = "#7c3aed",
  } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Video is Ready</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, ${workspacePrimaryColor} 0%, ${workspacePrimaryColor}dd 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    ${
      workspaceLogoUrl
        ? `<img src="${workspaceLogoUrl}" alt="${workspaceName}" style="max-width: 150px; height: auto; margin-bottom: 20px;">`
        : ""
    }
    <h1 style="color: white; margin: 0; font-size: 28px;">Your Video is Ready! 🎉</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your video <strong>${videoFilename}</strong> has been processed and is ready to download.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 30px;">
      We've automatically removed all the silent parts and stitched your video back together.
    </p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${downloadUrl}" style="display: inline-block; background: ${workspacePrimaryColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Download Your Video
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      This download link will expire in 24 hours for security reasons.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Thanks,<br>
      The ${workspaceName} Team
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>You're receiving this email because you uploaded a video for processing.</p>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Your video "${videoFilename}" is ready!`,
      html,
    });

    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

interface VideoFailedEmailParams {
  to: string;
  userName: string;
  videoFilename: string;
  errorMessage: string;
  workspaceName: string;
}

/**
 * Send video processing failed notification email
 */
export async function sendVideoFailedEmail(params: VideoFailedEmailParams) {
  const { to, userName, videoFilename, errorMessage, workspaceName } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Processing Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #ef4444; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Video Processing Failed</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${userName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Unfortunately, we encountered an error while processing your video <strong>${videoFilename}</strong>.
    </p>
    
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        <strong>Error:</strong> ${errorMessage}
      </p>
    </div>
    
    <p style="font-size: 16px; margin-top: 30px;">
      Your credit has been refunded. Please try uploading your video again, or contact support if the problem persists.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      Thanks,<br>
      The ${workspaceName} Team
    </p>
  </div>
</body>
</html>
  `;

  try {
    const result = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Failed to process "${videoFilename}"`,
      html,
    });

    return result;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
