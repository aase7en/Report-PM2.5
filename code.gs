/** ค่าคงที่สำหรับการตั้งค่าระบบ */ 
const CONFIG = {
  SPREADSHEET_ID: "1kBUKdezfAxIziq167e-RJV1nNZkeiaz6YQcpVAMja9w",
  LINE_TOKEN: [
      'DVDfc5aTttR3eUCG1pJCKj0ANO2ZDrOqPeZXqKvL6AI',// Direct
      '5mYp38Vlqd8KiYNkNZPFjjT43mv5SleerZ8Dko6pkDQ'// อสม
  ],
  API_ENDPOINTS: {
    THAI_AIR: "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?stationID=21t",
    GLOBAL_AIR: "https://api.waqi.info/feed/A419398/?token=a5dec343b1b32382758bf6f2d07c3f4af6238ebc"
  },
  PM25_LEVELS: {
    VERY_GOOD: { min: 0, max: 25, color: '#00E400' },
    GOOD: { min: 26, max: 37, color: '#FFFF00' },
    MODERATE: { min: 38, max: 50, color: '#FF7E00' },
    UNHEALTHY_SENSITIVE: { min: 51, max: 90, color: '#FF0000' },
    UNHEALTHY: { min: 91, max: Infinity, color: '#8F3F97' }
  }
};

/** สำหรับการจัดการ Errors */
class AirQualityError extends Error {
  constructor(message, type) {
    super(message);
    this.name = 'AirQualityError';
    this.type = type;
  }
}

// ฟังก์ชันสำหรับรวม HTML templates
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** เพิ่ม retry mechanism */
function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return UrlFetchApp.fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      Utilities.sleep(1000 * Math.pow(2, i)); // exponential backoff
    }
  }
}

/** ฟังก์ชันหลักที่จะถูกเรียกใช้ */
function main() {
  try {
    const airData = fetchAirQualityData();
    importDataToSpreadsheet(airData);
    const message = createMessage(airData);
    sendLineNotification(message);
    Logger.log('Air quality monitoring completed successfully');
  } catch (error) {
    handleError(error);
  }
}

/** ดึงข้อมูลคุณภาพอากาศจาก API */ 
function fetchAirQualityData() {
  try {
    const thaiResponse = fetchWithRetry(CONFIG.API_ENDPOINTS.THAI_AIR);
    const globalResponse = fetchWithRetry(CONFIG.API_ENDPOINTS.GLOBAL_AIR);
    
    const thaiData = JSON.parse(thaiResponse.getContentText());
    const globalData = JSON.parse(globalResponse.getContentText());
    
    // Validate data
    if (!thaiData || !globalData) {
      throw new Error('Invalid API response');
    }
    
    return {
      thai: thaiData,
      global: globalData
    };
  } catch (error) {
    throw new AirQualityError('Failed to fetch air quality data: ' + error.message, 'API_ERROR');
  }
}

/** ตรวจสอบระดับ PM2.5 และให้คำแนะนำ */ 
function getPM25Advice(pm25Value) {
  const levels = CONFIG.PM25_LEVELS;
  let advice = {
    level: '',
    color: '',
    generalAdvice: '',
    riskGroupAdvice: ''
  };

  if (pm25Value >= levels.UNHEALTHY.min) {
    advice = {
      level: 'มีผลกระทบต่อสุขภาพ',
      color: levels.UNHEALTHY.color,
      generalAdvice: 'ลดหรืองดการทำกิจกรรมนอกบ้าน หากจำเป็นต้องสวมหน้ากากป้องกัน PM2.5',
      riskGroupAdvice: 'งดออกนอกบ้าน และออกกำลังกายกลางแจ้ง ควรอยู่ในอาคาร'
    };
  } else if (pm25Value >= levels.UNHEALTHY_SENSITIVE.min) {
    advice = {
      level: 'เริ่มมีผลกระทบต่อสุขภาพ',
      color: levels.UNHEALTHY_SENSITIVE.color,
      generalAdvice: 'ควรลดหรือจำกัดการทำกิจกรรมนอกบ้าน',
      riskGroupAdvice: 'ลดเวลาการทำกิจกรรมออกนอกบ้าน'
    };
  } else if (pm25Value >= levels.MODERATE.min) {
    advice = {
      level: 'ปานกลาง',
      color: levels.MODERATE.color,
      generalAdvice: 'ควรหลีกเลี่ยงการทำกิจกรรมหรือออกกำลังกายกลางแจ้ง',
      riskGroupAdvice: 'ควรหลีกเลี่ยงการทำกิจกรรมนอกบ้าน'
    };
  } else if (pm25Value >= levels.GOOD.min) {
    advice = {
      level: 'ดี',
      color: levels.GOOD.color,
      generalAdvice: 'ทำกิจกรรมกลางแจ้งได้ตามปกติ',
      riskGroupAdvice: 'ควรหลีกเลี่ยงการทำกิจกรรมหรือออกกำลังกายกลางแจ้ง'
    };
  } else {
    advice = {
      level: 'ดีมาก',
      color: levels.VERY_GOOD.color,
      generalAdvice: 'ทำกิจกรรมกลางแจ้งได้ตามปกติ',
      riskGroupAdvice: 'ทำกิจกรรมกลางแจ้งได้ตามปกติ'
    };
  }
  
  return advice;
}

/** แปลงรูปแบบวันที่เป็นภาษาไทย */
function formatThaiDateTime(dateTimeStr) {
  const thaiMonths = {
    'January': 'มกราคม',
    'February': 'กุมภาพันธ์',
    'March': 'มีนาคม',
    'April': 'เมษายน',
    'May': 'พฤษภาคม',
    'June': 'มิถุนายน',
    'July': 'กรกฎาคม',
    'August': 'สิงหาคม',
    'September': 'กันยายน',
    'October': 'ตุลาคม',
    'November': 'พฤศจิกายน',
    'December': 'ธันวาคม'
  };

  try {
    const date = new Date(dateTimeStr);
    const formatted = Utilities.formatDate(date, "Asia/Bangkok", "dd-MMMM-yyyy HH:mm:ss");
    return formatted.replace(/(\d+)-(\w+)-(\d+) (\d+:\d+:\d+)/, (match, day, month, year, time) => {
      return `${day} ${thaiMonths[month]} พ.ศ.${parseInt(year) + 543} เวลา ${time}`;
    });
  } catch (error) {
    Logger.log('Error formatting date: ' + error.message);
    return dateTimeStr; // Return original string if formatting fails
  }
}

/** สร้างข้อความแจ้งเตือน */
function createMessage(airData) {
  try {
    const { global } = airData;
    if (!global?.data?.iaqi?.pm25?.v) {
      throw new Error('Invalid air quality data structure');
    }

    const pm25Value = global.data.iaqi.pm25.v;
    const advice = getPM25Advice(pm25Value);
    const formattedDateTime = formatThaiDateTime(global.data.time.s);

    const messageText = `
🔔 รายงานคุณภาพอากาศ โรงพยาบาลฉุกเฉิน
📅 ${formattedDateTime}

📊 ข้อมูลคุณภาพอากาศ:
• AQI(US) = ${global.data.aqi}
• PM2.5 = ${pm25Value} (μg/m³)
• PM10 = ${global.data.iaqi.pm10.v} (μg/m³)
• อุณหภูมิ = ${global.data.iaqi.t.v}°C

🏥 ระดับคุณภาพอากาศ: ${advice.level}

📝 คำแนะนำ:
• ประชาชนทั่วไป: ${advice.generalAdvice}
• กลุ่มเสี่ยง: ${advice.riskGroupAdvice}

🌐 ข้อมูลเพิ่มเติม: https://aqicn.org/station/@419398
    `.trim();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ชีต1');
    const chart = sheet?.getCharts()[0];
    const imageBlob = chart ? chart.getBlob().getAs("image/png") : null;

    return {
      message: messageText,
      imageFile: imageBlob
    };
  } catch (error) {
    throw new AirQualityError('Failed to create message: ' + error.message, 'MESSAGE_ERROR');
  }
}

/** ส่งการแจ้งเตือนไปยัง Line Notify */
function sendLineNotification(message) {
  if (!message?.message) {
    throw new AirQualityError('Invalid message object', 'NOTIFICATION_ERROR');
  }

  // วนลูปสำหรับแต่ละ Line Token
  CONFIG.LINE_TOKEN.forEach((token) => {
    const options = {
      "method": 'post',
      "headers": { 
        "Authorization": "Bearer " + token 
      },
      "payload": {
        "message": message.message,
        "imageFile": message.imageFile
      },
      "muteHttpExceptions": true
    };

    try {
      const response = UrlFetchApp.fetch("https://notify-api.line.me/api/notify", options);
      const responseCode = response.getResponseCode();

      if (responseCode !== 200) {
        throw new Error(`Line API returned status code ${responseCode} for token: ${token}`);
      }

      Logger.log(`Line notification sent successfully for token: ${token}`);
    } catch (error) {
      Logger.log(`Failed to send Line notification for token: ${token}. Error: ${error.message}`);
    }
  });
}

/** นำเข้าข้อมูลไปยัง Spreadsheet */
function importDataToSpreadsheet(airData) {
  try {
    const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("ชีต1");
    if (!sheet) {
      throw new Error('Sheet not found');
    }

    const { global } = airData;
    if (!global?.data) {
      throw new Error('Invalid air data structure');
    }
    
    // Format date
    const date = new Date(global.data.time.s);
    const dateString = Utilities.formatDate(date, "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
    
    // Manage rows (keep only last 7 days of data)
    if (sheet.getLastRow() > 7) {
      sheet.deleteRows(2, 1);
    }
    
    // Add new row with specified data
    sheet.appendRow([
      dateString,            // Timestamp
      global.data.aqi,       // AQI (US)
      global.data.iaqi.pm10.v, // PM10 (µg/m³)
      global.data.iaqi.pm25.v  // PM2.5 (µg/m³)
    ]);
    
    // Set column headers if not already set
    const headers = sheet.getRange(1, 1, 1, 4).getValues()[0];
    if (!headers[0]) {
      sheet.getRange(1, 1, 1, 4).setValues([
        ['Timestamp', 'AQI (US)', 'PM10 (µg/m³)', 'PM2.5 (µg/m³)']
      ]);
    }
    
    Logger.log("Data imported successfully to spreadsheet");
  } catch (error) {
    throw new AirQualityError('Failed to import data to spreadsheet: ' + error.message, 'SPREADSHEET_ERROR');
  }
}

/** จัดการข้อผิดพลาด */
function handleError(error) {
  const errorMessage = `🚨 เกิดข้อผิดพลาด: ${error.message}`;
  Logger.log(errorMessage);
  
  try {
    sendLineNotification({ message: errorMessage });
  } catch (notifyError) {
    Logger.log('Failed to send error notification: ' + notifyError.message);
  }
}

/** สร้าง Trigger สำหรับรันอัตโนมัติทุก 6 และ 16 น. */
function createDailyTrigger() {
  // ลบ Trigger เดิมทั้งหมด
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }

  // สร้าง Trigger ใหม่สำหรับเวลา 6:00 น. (GMT+7)
  ScriptApp.newTrigger('main')
    .timeBased()
    .atHour(6) // เวลา 6 โมงเช้า
    .everyDays(1) // ทุกวัน
    .create();

  // สร้าง Trigger ใหม่สำหรับเวลา 16:00 น. (GMT+7)
  ScriptApp.newTrigger('main')
    .timeBased()
    .atHour(16) // เวลา 4 โมงเย็น
    .everyDays(1) // ทุกวัน
    .create();
}

/** Web App functions */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Air Quality Widget')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
