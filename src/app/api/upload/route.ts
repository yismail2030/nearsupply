import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/utils/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/utils/response';

// Allowed file types
const ALLOWED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return errorResponse('No file provided', 400);
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('File size exceeds 10 MB limit', 400);
    }

    // Check file type
    const allowedExtensions = ALLOWED_TYPES[file.type];
    if (!allowedExtensions) {
      return errorResponse('File type not allowed', 400);
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return errorResponse('File extension not allowed', 400);
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', new Date().toISOString().split('T')[0]);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${timestamp}-${randomStr}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Return public URL
    const publicUrl = `/uploads/${new Date().toISOString().split('T')[0]}/${fileName}`;

    const attachment = {
      name: file.name,
      url: publicUrl,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.id,
    };

    return successResponse({ attachment }, 'File uploaded successfully');
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('Failed to upload file', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get('url');

    if (!fileUrl) {
      return errorResponse('No file URL provided', 400);
    }

    // Only allow deleting files from uploads directory
    if (!fileUrl.startsWith('/uploads/')) {
      return errorResponse('Invalid file URL', 400);
    }

    const filePath = path.join(process.cwd(), 'public', fileUrl);
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return errorResponse('File not found', 404);
    }

    // Delete file
    const { unlink } = await import('fs/promises');
    await unlink(filePath);

    return successResponse(null, 'File deleted successfully');
  } catch (error) {
    console.error('Delete error:', error);
    return errorResponse('Failed to delete file', 500);
  }
}
