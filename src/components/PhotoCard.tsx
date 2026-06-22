/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Eye, Loader2, ImageOff, Mail, Calendar, User } from 'lucide-react';
import { GalleryPhoto } from '../types';
import { getGmailAttachmentData } from '../lib/gmail';

interface PhotoCardProps {
  key?: any;
  photo: GalleryPhoto;
  accessToken: string;
  onPhotoLoaded: (id: string, dataUrl: string) => void;
  onPhotoClick: (photo: GalleryPhoto) => void;
}

export default function PhotoCard({
  photo,
  accessToken,
  onPhotoLoaded,
  onPhotoClick,
}: PhotoCardProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(photo.cachedDataUrl || null);
  const [loading, setLoading] = useState<boolean>(!photo.cachedDataUrl);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef<boolean>(!!photo.cachedDataUrl);

  useEffect(() => {
    // Se a foto já estiver cacheada globalmente, só atualizamos o estado local
    if (photo.cachedDataUrl) {
      setDataUrl(photo.cachedDataUrl);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchImageBytes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const base64Data = await getGmailAttachmentData(
          accessToken,
          photo.messageId,
          photo.attachmentId,
          photo.mimeType
        );

        if (isMounted) {
          setDataUrl(base64Data);
          setLoading(false);
          onPhotoLoaded(photo.id, base64Data);
          hasLoadedRef.current = true;
        }
      } catch (err: any) {
        console.error(`Erro ao carregar imagem ${photo.id}:`, err);
        if (isMounted) {
          setError('Não foi possível carregar o anexo.');
          setLoading(false);
        }
      }
    };

    fetchImageBytes();

    return () => {
      isMounted = false;
    };
  }, [photo.id, photo.cachedDataUrl, accessToken, photo.messageId, photo.attachmentId, photo.mimeType, onPhotoLoaded]);

  // Formatador curto para tamanhos de arquivo
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      id={`photo-card-${photo.id}`}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800/60 shadow-xl cursor-pointer hover:border-zinc-700/80 transition-all duration-300"
      onClick={() => dataUrl && onPhotoClick({ ...photo, cachedDataUrl: dataUrl })}
    >
      {/* Aspect Ratio Box (Usamos um container quadrado elegante ou 4:3) */}
      <div className="relative aspect-square w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-[10px] uppercase tracking-wider font-mono">Baixando anexo...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 p-4 text-center text-zinc-500 gap-2">
            <ImageOff className="w-8 h-8 text-zinc-600" />
            <p className="text-xs font-medium text-zinc-400">{error}</p>
            <span className="text-[9px] font-mono text-zinc-600 uppercase">Gmail attachment error</span>
          </div>
        )}

        {dataUrl && !loading && (
          <>
            <motion.img
              initial={{ filter: 'blur(10px)', scale: 1.05, opacity: 0 }}
              animate={{ filter: 'blur(0px)', scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              src={dataUrl}
              alt={photo.filename}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            
            {/* Hover overlay com gradiente moderno */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
              <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[10px] font-mono text-zinc-300 px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {formatSize(photo.size)}
              </span>
              
              <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-xs font-mono text-amber-400 mb-1 truncate">
                  {photo.filename}
                </p>
                <h4 className="text-sm font-semibold text-white tracking-tight leading-snug line-clamp-2 mb-1">
                  {photo.subject}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 truncate">
                  <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate">{photo.senderName}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Info footer visível por padrão abaixo do card (para excelente usabilidade móvel) */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800/40">
        <h3 className="text-sm font-semibold text-zinc-100 truncate mb-1" title={photo.subject}>
          {photo.subject}
        </h3>
        
        <div className="flex flex-col gap-1 text-[11px] text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <User className="w-3 h-3 text-zinc-500 shrink-0" />
            <span className="truncate font-medium text-zinc-300">{photo.senderName}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>{photo.date.split(',')[0]}</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800/40 shrink-0">
              {photo.filename.split('.').pop()?.toUpperCase() || 'IMG'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
