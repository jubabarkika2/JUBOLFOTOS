/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GalleryPhoto, GmailListResponse, PhotoEmail } from '../types';

// Função auxiliar para parsear e-mail e nome do remetente
export function parseSender(fromHeader: string): { name: string; email: string } {
  if (!fromHeader) return { name: 'Remetente Desconhecido', email: '' };
  
  // de: "Fulano de Tal <fulano@gmail.com>"
  const match = fromHeader.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    let name = match[1].replace(/['"]/g, '').trim();
    const email = match[2].trim();
    if (!name) {
      name = email.split('@')[0];
    }
    return { name, email };
  }
  
  return {
    name: fromHeader.split('@')[0] || fromHeader,
    email: fromHeader,
  };
}

// Função auxiliar para converter o formato base64url do Gmail para base64 padrão
export function base64UrlToBase64(baseStr: string): string {
  return baseStr.replace(/-/g, '+').replace(/_/g, '/');
}

// 1. Listar mensagens do Gmail com filtro de imagens
export async function listGmailPhotoMessages(
  accessToken: string,
  pageToken?: string,
  searchTerm?: string
): Promise<GmailListResponse> {
  // Construímos a query do Gmail. 
  // has:attachment filtra apenas mensagens com anexos.
  // filename:xxx limita às extensões comuns de imagem.
  let q = 'has:attachment filename:(jpg OR jpeg OR png OR gif OR webp OR bmp)';
  
  if (searchTerm && searchTerm.trim() !== '') {
    // Escapar aspas e adicionar à pesquisa
    const cleanSearch = searchTerm.replace(/"/g, '\\"');
    q += ` (${cleanSearch})`;
  }

  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.append('q', q);
  url.searchParams.append('maxResults', '25'); // Número razoável de mensagens por requisição
  if (pageToken) {
    url.searchParams.append('pageToken', pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar lista de mensagens do Gmail: ${response.statusText}`);
  }

  return response.json();
}

// Função recursiva para vasculhar as partes do e-mail em busca de anexos de imagens
function findImageAttachments(parts: any[], collected: any[] = []): any[] {
  if (!parts) return collected;

  for (const part of parts) {
    const filename = part.filename || '';
    const mimeType = part.mimeType || '';
    const body = part.body || {};
    const attachmentId = body.attachmentId;

    // Se é uma imagem E tem um attachmentId
    const isImage = mimeType.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename);

    if (isImage && attachmentId) {
      collected.push({
        id: attachmentId,
        filename: filename || 'imagem_sem_nome',
        mimeType: mimeType || 'image/jpeg',
        size: body.size || 0,
      });
    }

    // Se tiver partes aninhadas (email multipart), busca recursivamente
    if (part.parts) {
      findImageAttachments(part.parts, collected);
    }
  }

  return collected;
}

// 2. Buscar detalhes de uma mensagem específica para identificar fotos e metadados
export async function getGmailMessageDetails(
  accessToken: string,
  messageId: string
): Promise<PhotoEmail | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Erro ao buscar detalhes do email ${messageId}:`, response.statusText);
    return null;
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];
  
  // Extrai headers úteis
  const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(Sem Assunto)';
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Desconhecido';
  const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
  
  const { name: senderName, email: senderEmail } = parseSender(fromHeader);

  // Determina uma data amigável
  let formattedDate = dateHeader;
  const timestamp = parseInt(data.internalDate, 10) || Date.now();
  try {
    const dateObj = new Date(timestamp);
    formattedDate = dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    console.error('Erro ao formatar data do email:', e);
  }

  // Encontra os anexos de imagem nas partes da mensagem
  const attachments: any[] = [];
  if (data.payload) {
    if (data.payload.parts) {
      findImageAttachments(data.payload.parts, attachments);
    } else {
      // Se a própria raiz do payload contiver um anexo
      const filename = data.payload.filename || '';
      const mimeType = data.payload.mimeType || '';
      const body = data.payload.body || {};
      const attachmentId = body.attachmentId;

      const isImage = mimeType.startsWith('image/') || 
                      /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename);
      if (isImage && attachmentId) {
        attachments.push({
          id: attachmentId,
          filename: filename || 'imagem_sem_nome',
          mimeType: mimeType || 'image/jpeg',
          size: body.size || 0,
        });
      }
    }
  }

  // Se o email não tiver nenhuma imagem anexada, descartamos para a nossa galeria
  if (attachments.length === 0) {
    return null;
  }

  return {
    id: data.id,
    threadId: data.threadId,
    subject: subjectHeader,
    from: fromHeader,
    senderName,
    senderEmail,
    date: formattedDate,
    timestamp,
    attachments: attachments.map(att => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
    })),
  };
}

// 3. Buscar os bytes do anexo da imagem na API do Gmail
export async function getGmailAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string
): Promise<string> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter anexo do Gmail: ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.data) {
    throw new Error('Nenhum dado binário encontrado no anexo.');
  }

  // Converte de base64url do Gmail para base64 padrão
  const standardBase64 = base64UrlToBase64(result.data);
  return `data:${mimeType};base64,${standardBase64}`;
}
