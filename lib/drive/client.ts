import { google } from 'googleapis'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })
}

export function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

export function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

// Create a folder inside a parent folder
export async function createClientFolder(clientName: string, parentFolderId: string): Promise<{ id: string; url: string }> {
  const drive = getDrive()
  const res = await drive.files.create({
    requestBody: {
      name: clientName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
  })
  const id = res.data.id!
  return { id, url: `https://drive.google.com/drive/folders/${id}` }
}

// Copy the template tracker sheet into the client's folder
// Replaces "Master" in the template filename with the client's name
export async function copyTemplateSheet(
  templateSheetId: string,
  clientName: string,
  folderId: string
): Promise<{ id: string; url: string }> {
  const drive = getDrive()

  // Fetch the template's original filename
  const meta = await drive.files.get({ fileId: templateSheetId, fields: 'name' })
  const templateName = meta.data.name ?? 'Master Tracker'
  const copyName = templateName.replace(/master/i, clientName)

  const res = await drive.files.copy({
    fileId: templateSheetId,
    requestBody: {
      name: copyName,
      parents: [folderId],
    },
    fields: 'id',
  })
  const id = res.data.id!
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}` }
}

// Share a file/folder with the coach's Google account
export async function shareWithCoach(fileId: string, coachEmail: string) {
  const drive = getDrive()
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'writer',
      type: 'user',
      emailAddress: coachEmail,
    },
    sendNotificationEmail: false,
  })
}
