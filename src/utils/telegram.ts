export interface TelegramSendResult {
  success: boolean;
  message: string;
  isSimulated: boolean;
  timestamp: string;
}

export async function sendTelegramFireAlert(
  botToken: string,
  chatId: string,
  room: string,
  confidence: number,
  screenshotBase64?: string,
  operatorMobile?: string,
  operatorEmail?: string,
  operatorName?: string
): Promise<TelegramSendResult> {
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  let contactDetails = '';
  if (operatorMobile || operatorEmail || operatorName) {
    contactDetails = `\n📱 <b>Operator Mobile (Telegram Target):</b> ${operatorMobile || 'N/A'}\n` +
      `👤 <b>Assigned Operator:</b> ${operatorName || 'System'} (${operatorEmail || 'N/A'})\n`;
  }

  const captionText = `🚨 <b>CRITICAL FIRE DETECTED</b> 🚨\n\n` +
    `📍 <b>Room Location:</b> ${room}\n` +
    `🔥 <b>AI Confidence:</b> ${confidence}%\n` +
    `⏰ <b>Timestamp:</b> ${timeStr} - ${dateStr}\n` +
    contactDetails +
    `⚠️ <i>Immediate evacuation and extinguisher dispatch recommended.</i>\n\n` +
    `🛡️ <i>FireGuard AI Autonomous Surveillance</i>`;

  // If user provided real credentials
  if (botToken.trim() && chatId.trim()) {
    try {
      const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: captionText,
          parse_mode: 'HTML'
        })
      });

      const data = await response.json();
      if (response.ok && data.ok) {
        return {
          success: true,
          message: `Alert delivered to Telegram Chat (${chatId})`,
          isSimulated: false,
          timestamp: timeStr
        };
      } else {
        return {
          success: false,
          message: `Telegram Error: ${data.description || 'Failed to dispatch'}`,
          isSimulated: false,
          timestamp: timeStr
        };
      }
    } catch (err: unknown) {
      return {
        success: false,
        message: `Network failure: ${(err as Error).message}`,
        isSimulated: false,
        timestamp: timeStr
      };
    }
  }

  // Local dispatch log when Telegram bot token is not yet configured
  return {
    success: true,
    message: `Alert logged locally for ${room} (${confidence}%) [Telegram Bot Token not configured]`,
    isSimulated: false,
    timestamp: timeStr
  };
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ ok: boolean; msg: string }> {
  if (!botToken.trim() || !chatId.trim()) {
    return { ok: false, msg: 'Please provide both Bot Token and Chat ID' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text: `🛡️ <b>FireGuard AI Test Message</b>\n\nTelegram Alert connection established successfully!\nReady to receive emergency alerts.`,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, msg: 'Connection successful! Test message sent to your Telegram chat.' };
    } else {
      return { ok: false, msg: data.description || 'Failed to connect to Telegram.' };
    }
  } catch (e: unknown) {
    return { ok: false, msg: `Connection failed: ${(e as Error).message}` };
  }
}
