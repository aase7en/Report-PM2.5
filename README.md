# 🏭 Real-time PM2.5 Monitoring System

ระบบรายงานค่าฝุ่น PM2.5 แบบเรียลไทม์ อัพเดททุก 1 ชั่วโมง พร้อมแสดงผลบนหน้าจอ LED

[![Powered by Air4Thai API](https://img.shields.io/badge/data_source-air4thai-2CAF9F?logo=airplay-video&logoColor=white)](https://air4thai.pcd.go.th/)
[![Built with Google Apps Script](https://img.shields.io/badge/built_with-Google%20Apps%20Script-4285F4?logo=google-cloud&logoColor=white)](https://developers.google.com/apps-script)

![Dashboard Preview](./Report-PM2.5/Screenshot 2025-02-04 143521.png) <!-- ควรมีภาพตัวอย่าง -->

## ✨ คุณสมบัติหลัก
- 📊 ดึงข้อมูล PM2.5 ทุก 1 ชั่วโมงจาก API ฟรี
- 🗃️ บันทึกข้อมูลลง Google Sheet อัตโนมัติ
- 🌍 รองรับข้อมูลจากหลายแหล่ง (air4thai และ aqicn.org)
- 📡 สร้าง Widget แสดงผลแบบเรียลไทม์
- 🖥️ แสดงผลบนหน้าจอ LED ได้ทันที

## 📦 สถาปัตยกรรมระบบ
```mermaid
graph LR
    A[API Sources] -->|air4thai| B[Google Apps Script]
    A -->|aqicn.org| B
    B --> C[Google Sheets]
    C --> D[Web App Widget]
    D --> E[LED Display] 
