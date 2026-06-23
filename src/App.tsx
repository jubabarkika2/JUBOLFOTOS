/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Image, 
  LogOut, 
  RefreshCw, 
  Search, 
  Loader2, 
  Sparkles, 
  Filter, 
  Info, 
  User, 
  Calendar, 
  ChevronRight, 
  FolderHeart,
  FileImage,
  Inbox,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { initAuth, googleSignIn, googleSignInRedirect, logout } from './lib/firebase';
import { listGmailPhotoMessages, getGmailMessageDetails } from './lib/gmail';
import { GalleryPhoto, GmailListResponse } from './types';
import PhotoCard from './components/PhotoCard';
import ImageModal from './components/ImageModal';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSlowAuth, setIsSlowAuth] = useState<boolean>(false);

  // Detecção de Iframe para exibir aviso inteligente de nova aba
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Estados da Galeria
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetailsCount, setLoadingDetailsCount] = useState<number>(0);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [stats, setStats] = useState({ totalMessages: 0, loadedPhotos: 0 });

  // Busca e Filtros
  const [searchInput, setSearchInput] = useState<string>('');
  const [currentSearch, setCurrentSearch] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Inicializa a autenticação
  useEffect(() => {
    const backupTimer = setTimeout(() => {
      console.warn("Conexão com Google Auth demorou muito. Ativando painel de suporte...");
      setIsSlowAuth(true);
      setAuthChecking(false);
    }, 4500);

    const unsubscribe = initAuth(
      (currentUser, token) => {
        clearTimeout(backupTimer);
        setUser(currentUser);
        setAccessToken(token);
        setAuthChecking(false);
        setIsSlowAuth(false);
      },
      () => {
        clearTimeout(backupTimer);
        setUser(null);
        setAccessToken(null);
        setAuthChecking(false);
      }
    );

    return () => {
      clearTimeout(backupTimer);
      unsubscribe();
    };
  }, []);

  // Lógica de carregar fotos do Gmail
  const loadPhotosFromGmail = useCallback(async (
    token: string, 
    pageToLoad?: string, 
    searchQuery?: string,
    replaceExisting = false
  ) => {
    try {
      setLoadingList(true);
      if (replaceExisting) {
        setPhotos([]);
        setStats({ totalMessages: 0, loadedPhotos: 0 });
      }

      // 1. Busca IDs das mensagens que têm anexo
      const listRes: GmailListResponse = await listGmailPhotoMessages(token, pageToLoad, searchQuery);
      setNextPageToken(listRes.nextPageToken);
      
      const messages = listRes.messages || [];
      setStats((prev) => ({ 
        ...prev, 
        totalMessages: replaceExisting ? messages.length : prev.totalMessages + messages.length 
      }));

      if (messages.length === 0) {
        setLoadingList(false);
        return;
      }

      setLoadingDetailsCount(messages.length);

      // 2. Busca detalhes de cada e-mail concorrentemente 
      // mas injetando na tela conforme chegam para uma percepção super rápida!
      let resolvedCount = 0;

      await Promise.all(
        messages.map(async (msg) => {
          try {
            const details = await getGmailMessageDetails(token, msg.id);
            resolvedCount++;
            setLoadingDetailsCount(messages.length - resolvedCount);

            if (details && details.attachments.length > 0) {
              // Convertendo PhotoEmail attachments em GalleryPhoto
              const newPhotos: GalleryPhoto[] = details.attachments.map((att) => ({
                id: `${details.id}_${att.id}`,
                messageId: details.id,
                attachmentId: att.id,
                filename: att.filename,
                mimeType: att.mimeType,
                size: att.size,
                subject: details.subject,
                from: details.from,
                senderName: details.senderName,
                senderEmail: details.senderEmail,
                date: details.date,
                timestamp: details.timestamp,
                loading: false,
              }));

              setPhotos((prev) => {
                // Junta e remove duplicados se necessário
                const filteredPrev = prev.filter(p => !newPhotos.some(n => n.id === p.id));
                const combined = [...filteredPrev, ...newPhotos];
                // Ordena por data (timestamp decrescente - mais recente primeiro)
                return combined.sort((a, b) => b.timestamp - a.timestamp);
              });

              setStats((prev) => ({ ...prev, loadedPhotos: prev.loadedPhotos + newPhotos.length }));
            }
          } catch (err) {
            console.error(`Erro ao buscar detalhes da mensagem ${msg.id}:`, err);
            resolvedCount++;
            setLoadingDetailsCount(messages.length - resolvedCount);
          }
        })
      );

    } catch (err: any) {
      console.error('Erro na carga da galeria do Gmail:', err);
    } finally {
      setLoadingList(false);
      setLoadingDetailsCount(0);
    }
  }, []);

  // Monitora login e faz o primeiro fetch de fotos
  useEffect(() => {
    if (user && accessToken) {
      loadPhotosFromGmail(accessToken, undefined, undefined, true);
    }
  }, [user, accessToken, loadPhotosFromGmail]);

  // Função para lidar com login via popup (melhor para PC)
  const handleSignIn = async () => {
    let popupCheckTimer: any = null;
    try {
      setAuthChecking(true);
      setAuthError(null);
      
      // Timer de escape caso o popup seja bloqueado silenciosamente ou fechado de forma errática pelo navegador
      popupCheckTimer = setTimeout(() => {
        setAuthChecking(false);
        setAuthError('O popup de login parece ter sido bloqueado pelo seu navegador, ou está demorando muito para se comunicar. Se estiver no celular, prefira a opção "Login de Celular" ou abra o link do app diretamente no Chrome/Safari.');
      }, 7000);

      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setAccessToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Erro ao fazer login:', err);
      setAuthError('Ocorreu um problema ao conectar com sua conta Google via Popup. Certifique-se de autorizar os escopos solicitados.');
    } finally {
      if (popupCheckTimer) clearTimeout(popupCheckTimer);
      setAuthChecking(false);
    }
  };

  // Função para lidar com login via redirecionamento (melhor para celular)
  const handleSignInRedirect = async () => {
    let redirectCheckTimer: any = null;
    try {
      setAuthChecking(true);
      setAuthError(null);
      
      // Timer de escape caso o navegador móvel ou o iframe do AI Studio bloqueie silenciosamente a troca de página do login
      redirectCheckTimer = setTimeout(() => {
        setAuthChecking(false);
        setAuthError('O login por redirecionamento foi impedido pelo navegador ou pela moldura segura do AI Studio. Para funcionar com segurança em segundos: copie o link seguro do aplicativo abaixo e abra no navegador real do celular!');
        setIsSlowAuth(true);
      }, 4500);

      await googleSignInRedirect();
      // Nota: se o redirecionamento funcionar com sucesso, a página é recarregada pelo Firebase e o setTimeout não é executado.
    } catch (err: any) {
      console.error('Erro ao iniciar redirecionamento:', err);
      setAuthError('Falha ao iniciar o redirecionamento. Certifique-se de não estar dentro do visualizador restrito do AI Studio.');
      setAuthChecking(false);
    } finally {
      // Como o redirect abandona a página, não costuma passar pelo finally na página de origem se for bem-sucedido imediatamente,
      // mas se houver erro ao chamar a função, limpamos o timer.
      if (redirectCheckTimer) {
        // Deixamos o timer agir caso o redirect não troque a página de fato (ficando travado no sandbox)
      }
    }
  };

  // Função para deslogar
  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setPhotos([]);
    setStats({ totalMessages: 0, loadedPhotos: 0 });
  };

  // Atualiza cache de imagem carregada (evita múltiplos downloads caso o card re-carregue)
  const handlePhotoLoaded = (photoId: string, base64Url: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photoId ? { ...p, cachedDataUrl: base64Url } : p))
    );
  };

  // Dispara busca
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (accessToken) {
      setCurrentSearch(searchInput);
      loadPhotosFromGmail(accessToken, undefined, searchInput, true);
    }
  };

  // Limpa busca
  const handleClearSearch = () => {
    setSearchInput('');
    setCurrentSearch('');
    if (accessToken) {
      loadPhotosFromGmail(accessToken, undefined, '', true);
    }
  };

  // Filtra fotos localmente por tempo para ultra-rapidez
  const getFilteredPhotos = () => {
    if (timeFilter === 'all') return photos;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    return photos.filter((photo) => {
      const diff = now - photo.timestamp;
      if (timeFilter === 'today') return diff <= oneDay;
      if (timeFilter === 'week') return diff <= oneWeek;
      if (timeFilter === 'month') return diff <= oneMonth;
      return true;
    });
  };

  const filteredPhotos = getFilteredPhotos();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-neutral-900">
      
      {/* HEADER PRINCIPAL */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/45 sticky top-0 md:relative backdrop-blur-md z-45 w-full">
        <div id="main-header" className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Image className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Gmail Photo Gallery
              </h1>
              <p className="text-[10px] text-zinc-400 font-mono hidden sm:block">
                Sua caixa de entrada como um banco de dados de imagens
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800 px-3.5 py-1.5 rounded-xl">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-5 h-5 rounded-full ring-1 ring-zinc-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-4 h-4 text-zinc-400" />
                )}
                <span className="text-xs font-semibold text-zinc-300">
                  {user.displayName || user.email}
                </span>
              </div>

              <button
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 hover:text-red-400 text-zinc-300 flex items-center gap-2 transition-all duration-200"
                title="Desconectar"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        {authChecking ? (
          /* TELA DE AUTENTICANDO INOVADORA COM ESCAPE */
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 min-h-[55vh] text-center max-w-md mx-auto">
            <div className="relative mb-2">
              <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-amber-500/20 rounded-full blur-xs" />
            </div>
            
            <p className="text-sm font-bold text-zinc-200 uppercase tracking-widest animate-pulse">
              Verificando sua conta...
            </p>
            
            <p className="text-xs text-zinc-400 leading-relaxed">
              O Firebase está se comunicando com o Google. Se estiver no celular, o navegador pode tentar bloquear o login em segundo plano.
            </p>
            
            <div className="mt-4 flex flex-col gap-2 w-full">
              <button
                onClick={() => {
                  setAuthChecking(false);
                  setIsSlowAuth(true); // Ativa o painel de suporte
                  setAuthError('Carregamento interrompido pelo usuário. Para conectar sem problemas, siga as instruções de suporte abaixo.');
                }}
                className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-xs font-semibold text-zinc-400 hover:text-white rounded-xl transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Cancelar e Ver Painel de Suporte
              </button>
            </div>
          </div>
        ) : !user ? (
          /* TELA DE LOGIN (NÃO LOGADO) */
          <div className="flex-1 flex flex-col items-center justify-center py-6 md:py-12 max-w-2xl mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="w-full bg-zinc-900 border border-zinc-800/80 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden"
            >
              {/* Detalhe de luz ambiente em background */}
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

              <div className="flex flex-col items-center text-center">
                {/* Ícone customizado de Foto + Email */}
                <div className="relative mb-8">
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/5">
                    <Image className="w-10 h-10" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white border-2 border-zinc-900 shadow-lg animate-bounce">
                    <Mail className="w-4 h-4" />
                  </div>
                </div>

                <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                  Suas fotos de e-mail,<br />
                  organizadas em uma <span className="text-amber-500">Galeria</span>
                </h2>
                
                <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-md">
                  É possível sim! Com este app, você não precisa de novos bancos de dados ou serviços caros de nuvem. Use o seu próprio <strong className="text-zinc-200 font-semibold">Gmail</strong> para agrupar e exibir todas as fotos que você recebe por e-mail automaticamente.
                </p>

                <div className="mt-6 flex flex-col items-center gap-3.5 bg-zinc-950/65 border border-zinc-800/60 rounded-2xl p-4.5 text-left text-xs text-zinc-400 max-w-md w-full">
                  <div className="flex gap-2.5 items-start">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>Todas as fotos enviadas ou recebidas que contenham anexos (JPG, PNG, WEBP, etc.) serão indexadas em tempo real.</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <FolderHeart className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>Nenhuma imagem é armazenada fora do seu Gmail: os dados permanecem estritamente na sua conta de e-mail.</span>
                  </div>
                </div>

                {(isIframe || isSlowAuth) && (
                  <div className="mt-6 p-5 bg-zinc-950/80 border border-amber-500/30 rounded-2xl text-left max-w-md w-full shadow-lg">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="w-full">
                        <h4 className="text-sm font-bold text-amber-400 leading-snug">⚠️ Problemas para conectar ou carregamento infinito?</h4>
                        <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                          O painel do AI Studio roda dentro de uma moldura de segurança (iframe) que **bloqueia popups, cookies de terceiros e logins de contas do Google** (especialmente em celulares ou guias anônimas).
                        </p>
                        
                        <div className="mt-4 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                          <p className="text-xs font-semibold text-zinc-200">Como resolver em 2 passos simples:</p>
                          <ol className="mt-2 space-y-2 text-[11px] text-zinc-400 list-decimal list-inside">
                            <li>Copie o link seguro do aplicativo abaixo.</li>
                            <li>Abra o seu navegador nativo (<strong className="text-zinc-300">Safari</strong> no iPhone ou <strong className="text-zinc-300">Chrome</strong> no Android) e cole o link para acessar diretamente, fora do AI Studio!</li>
                          </ol>
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                          <button 
                            onClick={handleCopyLink}
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors active:scale-95"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 text-neutral-950" />
                                Link Copiado!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copiar Link do App
                              </>
                            )}
                          </button>
                          
                          <a 
                            href={window.location.href} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors active:scale-95 border border-zinc-700/50"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Abrir em Nova Aba
                          </a>
                        </div>
                        
                        <p className="text-[10px] text-zinc-500 mt-3 text-center italic font-mono break-all">
                          {typeof window !== 'undefined' ? window.location.href : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {authError && (
                  <div className="mt-6 p-4 bg-red-950/50 border border-red-900/50 rounded-2xl text-xs text-red-300 text-left max-w-md w-full">
                    {authError}
                  </div>
                )}

                {/* Botões Oficiais Google SignIn (Popup vs Redirect) */}
                <div className="mt-8 w-full max-w-sm flex flex-col gap-3">
                  {/* Botão de Redirecionamento (Recomendado para Celulares e Navegadores Mobile) */}
                  <button 
                    onClick={handleSignInRedirect}
                    className="group relative flex items-center justify-center gap-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3.5 px-6 rounded-2xl shadow-xl transition-all duration-200 cursor-pointer active:scale-98 w-full border border-amber-400"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <div className="text-left font-sans">
                      <div className="text-sm font-extrabold leading-none">Login de Celular</div>
                      <div className="text-[9px] text-zinc-800 font-medium">Método por Redirecionamento</div>
                    </div>
                  </button>

                  {/* Botão de Popup (Ideal para computadores e laptops) */}
                  <button 
                    onClick={handleSignIn}
                    className="group relative flex items-center justify-center gap-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl transition-all duration-200 border border-zinc-700/50 cursor-pointer active:scale-98 w-full"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <div className="text-left font-sans">
                      <div className="text-xs font-bold leading-none">Login de Computador</div>
                      <div className="text-[8px] text-zinc-400 font-mono">Abre uma janela Popup</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : (
          /* PAINEL LOGADO DE GALERIA */
          <div className="flex-1 flex flex-col gap-6" id="dashboard-logged">
            
            {/* PAINEL DE FILTROS E BUSCA */}
            <section className="bg-zinc-900 border border-zinc-800/80 p-5 md:p-6 rounded-2xl flex flex-col gap-5 shadow-lg">
              
              {/* Campo de Pesquisa */}
              <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 text-zinc-500 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Busque por assunto, remetente, nome do arquivo de foto (ex: praia, .png, etc.)"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/60 rounded-xl py-3 pl-12 pr-10 text-sm placeholder-zinc-500 select-none outline-none focus:ring-1 focus:ring-amber-500/25 transition-all text-zinc-100"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-3 top-3 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white px-2 py-1 rounded transition-colors"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loadingList}
                    className="flex-1 md:flex-initial bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-neutral-950 font-bold px-6 py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-500/5 active:scale-98"
                  >
                    {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Pesquisar
                  </button>

                  <button
                    type="button"
                    onClick={() => accessToken && loadPhotosFromGmail(accessToken, undefined, currentSearch, true)}
                    disabled={loadingList}
                    className="p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 rounded-xl text-zinc-300 disabled:text-zinc-600 transition-colors cursor-pointer"
                    title="Recarregar/Sincronizar"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin text-amber-500' : ''}`} />
                  </button>
                </div>
              </form>

              {/* Divisor */}
              <hr className="border-zinc-800/80" />

              {/* Linha Subjacente com Filtros Rápidos de Tempo e Estatísticas */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Abas de Tempo */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  <span className="text-zinc-500 text-xs shrink-0 flex items-center gap-1.5 mr-2 font-mono uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5" />
                    Tempo:
                  </span>
                  {[
                    { id: 'all', label: 'Todas as Fotos' },
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: 'Última Semana' },
                    { id: 'month', label: 'Último Mês' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setTimeFilter(filter.id as any)}
                      className={`text-xs px-3.5 py-2 rounded-xl transition-all font-semibold shrink-0 cursor-pointer ${
                        timeFilter === filter.id
                          ? 'bg-amber-500 text-neutral-900 shadow-md shadow-amber-500/10'
                          : 'bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                {/* Status da Carga do Gmail */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {loadingDetailsCount > 0 && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3.5 py-1.5 rounded-xl font-mono text-[10px] uppercase tracking-wider animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processando {loadingDetailsCount} e-mails...</span>
                    </div>
                  )}

                  <div className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl text-zinc-400 font-mono text-[11px] flex gap-3">
                    <div>
                      E-mails analisados: <strong className="text-zinc-200">{stats.totalMessages}</strong>
                    </div>
                    <div className="border-l border-zinc-800 pl-3">
                      Fotos na galeria: <strong className="text-zinc-200">{photos.length}</strong>
                    </div>
                  </div>
                </div>

              </div>

            </section>

            {/* SEÇÃO DA GRADE DA GALERIA */}
            <section className="flex-1 flex flex-col">
              
              {/* Estado Vazio de Fotos */}
              {filteredPhotos.length === 0 && !loadingList && (
                <div id="empty-gallery" className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-900/35 border border-dashed border-zinc-800/80 rounded-2xl min-h-[40vh] my-4">
                  <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 mb-4 shadow-inner">
                    <Inbox className="w-8 h-8" />
                  </div>
                  <h3 className="text-md font-bold text-zinc-200">
                    {currentSearch ? 'Nenhuma foto encontrada para a pesquisa' : 'Nenhuma foto encontrada'}
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mt-2 leading-relaxed">
                    {currentSearch 
                      ? 'Experimente alterar sua palavra-chave de busca ou verifique se há fotos equivalentes.' 
                      : 'Não identificamos nenhuma foto como anexo nos seus emails recentes. Envie um email com fotos de anexo (tipo JPG ou PNG) para você mesmo para ver a magia acontecer!'}
                  </p>
                  
                  {!currentSearch && (
                    <button
                      onClick={() => accessToken && loadPhotosFromGmail(accessToken, undefined, undefined, true)}
                      className="mt-5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-zinc-700/50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Verificar E-mails Novamente
                    </button>
                  )}
                </div>
              )}

              {/* Loader se estiver carregando a lista inicial do Gmail e não houver fotos ainda */}
              {loadingList && photos.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[30vh]">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
                  <p className="text-sm text-zinc-400 font-mono uppercase tracking-wider text-center animate-pulse">
                    Varrendo sua caixa de entrada no Gmail...
                  </p>
                </div>
              )}

              {/* Grade de Fotos */}
              {filteredPhotos.length > 0 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {filteredPhotos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        accessToken={accessToken!}
                        onPhotoLoaded={handlePhotoLoaded}
                        onPhotoClick={setSelectedPhoto}
                      />
                    ))}
                  </div>

                  {/* Paginação / Carregar Mais */}
                  {nextPageToken && (
                    <div className="flex justify-center pt-8 border-t border-zinc-900">
                      <button
                        onClick={() => accessToken && loadPhotosFromGmail(accessToken, nextPageToken, currentSearch, false)}
                        disabled={loadingList}
                        className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 hover:text-white border border-zinc-800 hover:border-zinc-700 rounded-xl text-sm font-semibold transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:shadow-zinc-950/20 active:scale-98 cursor-pointer"
                      >
                        {loadingList ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        ) : (
                          <FileImage className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        Carregar Mais Fotos
                      </button>
                    </div>
                  )}
                </div>
              )}

            </section>
          </div>
        )}
      </main>

      {/* FOOTER DO APP */}
      <footer className="border-t border-zinc-900 bg-neutral-950/40 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Gmail Photo Gallery App • Versão 1.0</span>
          </div>
          <div>
            <span>Conectado de forma segura via Google OAuth</span>
          </div>
        </div>
      </footer>

      {/* MODAL DE AMPLIAÇÃO */}
      <ImageModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  );
}
