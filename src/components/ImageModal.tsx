/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Mail, Calendar, User, Info, FileImage, ShieldAlert } from 'lucide-react';
import { GalleryPhoto } from '../types';

interface ImageModalProps {
  photo: GalleryPhoto | null;
  onClose: () => void;
}

export default function ImageModal({ photo, onClose }: ImageModalProps) {
  if (!photo) return null;

  // Função para fazer o download nativo da imagem através de dataUrl
  const handleDownload = () => {
    if (!photo.cachedDataUrl) return;
    
    const link = document.createElement('a');
    link.href = photo.cachedDataUrl;
    link.download = photo.filename || `gmail_photo_${photo.messageId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatador curto para tamanhos de arquivo
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
        {/* Backdrop escuro com blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Container do Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 max-h-[90vh]"
        >
          {/* Botão de Fechar no topo direito (para mobile/desktop) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-neutral-950/70 border border-white/5 text-zinc-300 hover:text-white transition-colors duration-200"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Seção da Imagem (Esquerda / Topo) */}
          <div className="relative flex-1 bg-zinc-950 flex items-center justify-center p-4 min-h-[40vh] md:min-h-0 overflow-hidden">
            {photo.cachedDataUrl ? (
              <img
                src={photo.cachedDataUrl}
                alt={photo.filename}
                className="max-w-full max-h-[50vh] md:max-h-[75vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-zinc-500 flex flex-col items-center gap-3">
                <ShieldAlert className="w-12 h-12 text-amber-500" />
                <p>Nenhuma imagem carregada</p>
              </div>
            )}
          </div>

          {/* Seção de Detalhes do E-mail (Direita / Base) */}
          <div className="w-full md:w-[350px] bg-zinc-900 p-6 flex flex-col border-t md:border-t-0 md:border-l border-zinc-800">
            {/* Header / Título */}
            <div className="mb-6">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-500 font-mono flex items-center gap-1.5 mb-1.5">
                <FileImage className="w-3.5 h-3.5" />
                Informações do Anexo
              </span>
              <h3 className="text-md font-bold text-zinc-100 break-words line-clamp-2" title={photo.filename}>
                {photo.filename}
              </h3>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                {photo.mimeType} • {formatSize(photo.size)}
              </p>
            </div>

            <hr className="border-zinc-800 my-4" />

            {/* Metadados do Gmail */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5 mb-1 bg-zinc-950/45 px-2 py-0.5 rounded w-max">
                  <Mail className="w-3 h-3" />
                  Assunto do E-mail
                </span>
                <p className="text-sm font-semibold text-zinc-200 leading-snug break-words">
                  {photo.subject}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5 mb-1 bg-zinc-950/45 px-2 py-0.5 rounded w-max">
                  <User className="w-3 h-3" />
                  Remetente
                </span>
                <p className="text-sm font-semibold text-zinc-200 truncate">
                  {photo.senderName}
                </p>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {photo.senderEmail}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider flex items-center gap-1.5 mb-1 bg-zinc-950/45 px-2 py-0.5 rounded w-max">
                  <Calendar className="w-3 h-3" />
                  Data de Recebimento
                </span>
                <p className="text-sm font-medium text-zinc-300">
                  {photo.date}
                </p>
              </div>
            </div>

            <hr className="border-zinc-800 my-4" />

            {/* Ações */}
            <div className="mt-auto pt-2">
              <button
                onClick={handleDownload}
                disabled={!photo.cachedDataUrl}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed hover:shadow-lg disabled:shadow-none hover:shadow-amber-500/10 text-neutral-950 flex items-center justify-center gap-2 transition-all duration-200"
              >
                <Download className="w-4 h-4 shrink-0" />
                Baixar esta Foto
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
