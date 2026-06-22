/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  dataUrl?: string; // Se já tiver sido carregada
}

export interface PhotoEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  senderName: string;
  senderEmail: string;
  date: string; // ISO ou formatado
  timestamp: number;
  attachments: GmailAttachment[];
}

export interface GalleryPhoto {
  id: string; // Combinação de messageId + attachmentId para chave única
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  subject: string;
  from: string;
  senderName: string;
  senderEmail: string;
  date: string;
  timestamp: number;
  cachedDataUrl?: string; // Armazena a imagem base64 de fato
  loading: boolean;
  error?: string;
}

export interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}
