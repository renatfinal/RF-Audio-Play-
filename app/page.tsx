"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, List, Search, FolderPlus, Folder, Link as LinkIcon, 
  Plus, Upload, Trash2, ArrowLeft, Download, Wifi, Copy, CheckCircle,
  Share2, GripVertical, Circle, CircleDot, Edit2, ArrowRight
} from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  lyrics: string;
  isFavorite: boolean;
  fileBlob?: Blob;
  url: string;
}

interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}

const DB_NAME = "rf_audio_storage";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveAudioFile(track: Track): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(track);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
    });
}

async function loadAllTracks(): Promise<Track[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function deleteAudioFile(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
    });
}

export default function RFAudioPlayer() {
  const [currentTab, setCurrentTab] = useState<'player' | 'library' | 'downloader' | 'colabore'>('player');
  const [libraryTab, setLibraryTab] = useState<'tracks' | 'playlists'>('tracks');
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Record<string, Playlist>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('rf_playlists');
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.error("Local storage access denied", e);
        return {};
      }
    }
    return {};
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [showToastMsg, setShowToastMsg] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const [editingTrack, setEditingTrack] = useState<{id: string, title: string, artist: string} | null>(null);
  const [addToPlaylistTrackId, setAddToPlaylistTrackId] = useState<string | null>(null);
  
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressFiringRef = useRef<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Filtered tracks for library display
  const filteredTracks = tracks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()));

  const currentTrack = currentTrackIndex >= 0 && currentTrackIndex < tracks.length ? tracks[currentTrackIndex] : null;

  useEffect(() => {
    try {
      window.localStorage.setItem('rf_playlists', JSON.stringify(playlists));
    } catch (e) {
      console.error("Local storage access denied", e);
    }
  }, [playlists]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setShowToastMsg(true);
    setTimeout(() => setShowToastMsg(false), 2500);
  };

  const loadTrack = (index: number) => {
    if (index < 0 || index >= tracks.length) return;
    setCurrentTrackIndex(index);
    // audio play is handled in effect or handlers
  };

  const togglePlay = () => {
    if (currentTrackIndex === -1 && tracks.length > 0) {
      playSpecificTrack(0);
      return;
    }
    if (currentTrackIndex === -1) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((e: any) => {
            if (e?.name !== 'AbortError') {
              console.error("Audio error:", e);
              setIsPlaying(false);
              showToast("Erro ao reproduzir: " + (e?.message || "Arquivo inválido"));
            }
          });
        }
      }
      setIsPlaying(true);
    }
  };

  const currentUrlRef = useRef<string | null>(null);

  const playSpecificTrack = async (index: number) => {
    const track = tracks[index];
    if (!track) return;
    
    setCurrentTrackIndex(index);
    setCurrentTab('player');
    
    let playUrl = track.url;
    
    // If it's a dead blob URL from a previous session (and no fileBlob), it will fail.
    if (playUrl && playUrl.startsWith('blob:') && !track.fileBlob) {
        showToast("Este arquivo local não pode ser reproduzido porque não foi salvo corretamente.");
        return;
    }

    if (!playUrl && track.fileBlob) {
        playUrl = URL.createObjectURL(track.fileBlob);
        
        // Update in state immutably
        setTracks(prev => prev.map((t, i) => i === index ? { ...t, url: playUrl } : t));
    }
    
    if (!playUrl) {
        showToast("Arquivo não encontrado");
        return;
    }
    
    if (audioRef.current) {
      if (currentUrlRef.current !== playUrl) {
        audioRef.current.src = playUrl;
        audioRef.current.load();
        currentUrlRef.current = playUrl;
      }
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((e: any) => {
          if (e?.name !== 'AbortError') {
            console.error("Autoplay prevented or unsupported error:", e);
            setIsPlaying(false);
            showToast("Erro ao reproduzir: " + (e?.message || 'Arquivo inválido'));
          }
        });
      }
    }
    setIsPlaying(true);
  };

  const onTrackEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((e: any) => {
            if (e?.name !== 'AbortError') {
              console.error("Error repeating track:", e);
              setIsPlaying(false);
              showToast("Erro ao repetir a faixa.");
            }
          });
        }
      }
    } else {
      nextTrack();
    }
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    
    let nextIdx = currentTrackIndex + 1;
    
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * tracks.length);
      playSpecificTrack(nextIdx);
      return;
    }

    if (nextIdx >= tracks.length) {
      if (repeatMode === "all") {
        nextIdx = 0;
      } else {
        // Stop playing
        setIsPlaying(false);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setCurrentTrackIndex(0); // Reset to first track
        return;
      }
    }
    
    playSpecificTrack(nextIdx);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    let prevIdx = currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = tracks.length - 1;
    
    if (isShuffle) {
      prevIdx = Math.floor(Math.random() * tracks.length);
    }
    
    playSpecificTrack(prevIdx);
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const toggleFavorite = () => {
    if (currentTrackIndex === -1) return;
    const newTracks = [...tracks];
    newTracks[currentTrackIndex].isFavorite = !newTracks[currentTrackIndex].isFavorite;
    setTracks(newTracks);
  };

  const deleteTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTracks(tracks.filter(t => t.id !== id));
    
    // Also remove from DB
    deleteAudioFile(id).catch(console.error);

    // Also remove from any custom playlist
    setPlaylists(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(plId => {
        next[plId] = {
          ...next[plId],
          trackIds: next[plId].trackIds.filter(tid => tid !== id)
        };
      });
      return next;
    });

    if (currentTrack?.id === id) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setCurrentTrackIndex(-1);
      setCurrentTime(0);
      setDuration(0);
    }
  };

  const deleteSelectedPlaylist = () => {
    if (!selectedPlaylistId) return;
    const next = { ...playlists };
    delete next[selectedPlaylistId];
    setPlaylists(next);
    setSelectedPlaylistId(null);
    showToast("Playlist excluída com sucesso.");
  };

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    isLongPressFiringRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressFiringRef.current = true;
      setSelectedPlaylistId(prev => prev === id ? null : id);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); // 500ms long press
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClickPlaylist = (id: string, e: React.MouseEvent) => {
    if (isLongPressFiringRef.current) {
        isLongPressFiringRef.current = false;
        return;
    }
    if (selectedPlaylistId) {
        setSelectedPlaylistId(id === selectedPlaylistId ? null : id);
        return;
    }
    setActivePlaylistId(id);
  };

  const addTrackToSelectedPlaylist = (playlistId: string) => {
    if (!addToPlaylistTrackId) return;
    setPlaylists(prev => {
      const pl = prev[playlistId];
      if (!pl) return prev;
      if (pl.trackIds.includes(addToPlaylistTrackId)) {
        showToast("Música já está na playlist.");
        return prev;
      }
      showToast("Música adicionada à playlist!");
      return {
        ...prev,
        [playlistId]: {
          ...pl,
          trackIds: [...pl.trackIds, addToPlaylistTrackId]
        }
      };
    });
    setAddToPlaylistTrackId(null);
  };

  const saveTrackEdit = () => {
    if (!editingTrack) return;
    setTracks(prev => prev.map(t => {
      if (t.id === editingTrack.id) {
        return { ...t, title: editingTrack.title || 'Unknown Title', artist: editingTrack.artist || 'Unknown Artist' };
      }
      return t;
    }));
    setEditingTrack(null);
    showToast("Informações atualizadas!");
  };

  useEffect(() => {
    loadAllTracks().then(savedTracks => {
      if (savedTracks.length > 0) {
        const loadedTracks = savedTracks.map(track => {
          if (track.fileBlob) {
            track.url = URL.createObjectURL(track.fileBlob);
          }
          return track;
        });
        setTracks(loadedTracks);
      }
    }).catch(console.error);
  }, []);

  const handleLocalFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newTracks: Track[] = [];
    let skipped = 0;
    
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith('audio/') && !f.type.startsWith('video/')) {
        if (!f.name.match(/\.(mp3|wav|ogg|m4a|weba|aac|flac|wma)$/i)) {
          skipped++;
          continue;
        }
      }
      
      const objectUrl = URL.createObjectURL(f);
      const cleanTitle = f.name.replace(/\.[^/.]+$/, "");
      const themes = ['sunset', 'sea', 'ocean', 'glacier', 'forest', 'fullmoon', 'jesus'];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];
      
      const newT: Track = {
        id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: cleanTitle,
        artist: "Arquivo Local",
        cover: `https://loremflickr.com/400/400/${randomTheme}?lock=${Math.floor(Math.random() * 10000)}`,
        lyrics: "",
        isFavorite: false,
        fileBlob: f,
        url: objectUrl
      };
      
      try {
        await saveAudioFile(newT);
      } catch (err) {
        console.error("Error saving track to IndexedDB", err);
      }
      
      newTracks.push(newT);
    }
    
    setTracks(prev => [...prev, ...newTracks]);
    if (newTracks.length > 0) {
      showToast(`${newTracks.length} áudio(s) importados!${skipped > 0 ? ` (${skipped} arquivo(s) ignorado)` : ''}`);
    } else {
      showToast(`Nenhum áudio válido encontrado (${skipped} arquivo(s) ignorado).`);
    }
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const createNewPlaylist = () => {
    const count = Object.keys(playlists).length + 1;
    const newId = 'pl_' + Date.now();
    const newPlaylist: Playlist = { id: newId, name: `Minha Playlist ${count}`, trackIds: [] };
    setPlaylists(prev => ({ ...prev, [newId]: newPlaylist }));
    setActivePlaylistId(newId);
  };

  const handlePlaylistImport = async (e: React.ChangeEvent<HTMLInputElement>, playlistId: string) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newTracks: Track[] = [];
    let skipped = 0;
    
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (!f.type.startsWith('audio/') && !f.type.startsWith('video/')) {
            if (!f.name.match(/\.(mp3|wav|ogg|m4a|weba|aac|flac|wma)$/i)) {
                skipped++;
                continue;
            }
        }
        
        const objectUrl = URL.createObjectURL(f);
        const cleanTitle = f.name.replace(/\.[^/.]+$/, "");
        const themes = ['sunset', 'sea', 'ocean', 'glacier', 'forest', 'fullmoon', 'jesus'];
        const randomTheme = themes[Math.floor(Math.random() * themes.length)];
        
        const newT: Track = {
            id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${i}`,
            title: cleanTitle,
            artist: "Arquivo Local",
            cover: `https://loremflickr.com/400/400/${randomTheme}?lock=${Math.floor(Math.random() * 10000)}`,
            lyrics: "",
            isFavorite: false,
            fileBlob: f,
            url: objectUrl
        };
        
        try {
          await saveAudioFile(newT);
        } catch (err) {
          console.error("Error saving track to IndexedDB", err);
        }
        
        newTracks.push(newT);
    }
    
    if (newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
        setPlaylists(prev => {
            const pl = prev[playlistId];
            if (!pl) return prev;
            return {
                ...prev,
                [playlistId]: {
                    ...pl,
                    trackIds: [...pl.trackIds, ...newTracks.map(t => t.id)]
                }
            };
        });
        showToast(`${newTracks.length} áudio(s) adicionados!${skipped > 0 ? ` (${skipped} ignorados)` : ''}`);
    } else {
        showToast(`Nenhum áudio válido (${skipped} ignorados).`);
    }
  };

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, idx: number, playlistId: string) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;

    const playlist = playlists[playlistId];
    if (!playlist) return;

    const newTrackIds = [...playlist.trackIds];
    const item = newTrackIds.splice(draggedIdx, 1)[0];
    newTrackIds.splice(idx, 0, item);

    setPlaylists({
      ...playlists,
      [playlistId]: { ...playlist, trackIds: newTrackIds }
    });
    setDraggedIdx(null);
  };

  const shareTrack = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share && track.fileBlob) {
        try {
            const fileName = `${track.title} - ${track.artist}.mp3`;
            const file = new File([track.fileBlob], fileName, { type: track.fileBlob.type || 'audio/mp3' });
            await navigator.share({
                title: track.title,
                text: 'Ouça esta música no RF Audio Player!',
                files: [file]
            });
        } catch (err: any) {
             // Ignoring share errors (e.g. user canceled share, or AbortError)
        }
    } else if (navigator.share && track.url.includes('http')) {
        try {
            await navigator.share({
                title: track.title,
                text: 'Ouça esta música no RF Audio Player!',
                url: track.url
            });
        } catch (err: any) {
             // Ignoring share errors
        }
    } else {
        showToast("Seu dispositivo não suporta o compartilhamento Web neste momento.");
    }
  };

  // Downloader logic
  const [ytUrl, setYtUrl] = useState("");
  const [streamUrl, setStreamUrl] = useState("");

  const playDirectStreamUrl = () => {
    const url = streamUrl.trim();
    if (!url) {
      showToast("Por favor, cole um link de streaming válido!");
      return;
    }
    const streamTrack: Track = {
      id: 'stream_' + Date.now(),
      title: "Link de Áudio Externo",
      artist: url.substring(0, 35) + "...",
      cover: "",
      lyrics: "Executando via link direto sem download.",
      isFavorite: false,
      url: url
    };
    
    setTracks(prev => [streamTrack, ...prev]);
    setStreamUrl("");
    playSpecificTrack(0); // Will play the newly prepended track
    showToast("Iniciando Streaming direto!");
  };

  const nextTrackRef = useRef(nextTrack);
  const prevTrackRef = useRef(prevTrack);
  const togglePlayRef = useRef(togglePlay);

  useEffect(() => {
    nextTrackRef.current = nextTrack;
    prevTrackRef.current = prevTrack;
    togglePlayRef.current = togglePlay;
  });

  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: currentTrack.cover || 'https://loremflickr.com/400/400/music', sizes: '400x400', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.error(e));
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
    }
  }, [currentTrack]);

  return (
    <div className="bg-[#0f0b21] sm:bg-[#06040d] text-[#f1f1f9] min-h-[100dvh] w-full flex justify-center items-center sm:p-4 font-sans overflow-hidden">
      <div className="w-full sm:max-w-[430px] bg-[#0f0b21] sm:rounded-[24px] sm:shadow-[0_20px_50px_rgba(0,0,0,0.8)] sm:border border-[#241b4e] overflow-hidden flex flex-col h-[100dvh] sm:h-[92vh] sm:max-h-[900px] relative">
        
        {/* Toast */}
        <div className={`absolute top-5 left-1/2 -translate-x-1/2 bg-[#9d4edd]/95 text-white py-2.5 px-5 rounded-full text-sm font-semibold z-[100] transition-all duration-300 shadow-lg whitespace-nowrap pointer-events-none ${showToastMsg ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}`}>
          {toastMsg}
        </div>

        {/* --- AUDIO ELEMENT --- */}
        <audio 
          ref={audioRef}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onTrackEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="hidden"
        />

        {/* --- MAIN CONTENT AREA --- */}
        <div className="flex-1 overflow-y-auto pb-[120px] p-5 flex flex-col custom-scrollbar">

          {/* TELA 1: PLAYER */}
          {currentTab === 'player' && (
            <div className="flex flex-col flex-1 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-5">
                <button 
                  onClick={toggleFavorite} 
                  className="w-10 h-10 flex justify-center items-center rounded-full hover:bg-white/5 transition-colors"
                >
                  <Heart className={`w-6 h-6 ${currentTrack?.isFavorite ? 'fill-red-500 text-red-500' : 'text-[#7b749b]'}`} />
                </button>
                <h2 className="text-[1rem] font-bold tracking-[2px] text-transparent bg-clip-text bg-gradient-to-r from-[#c77dff] to-[#48cae4] drop-shadow-[0_0_8px_rgba(199,125,255,0.6)] uppercase">RF Audio Player</h2>
                <button 
                  onClick={() => setCurrentTab('library')}
                  className="w-10 h-10 flex justify-center items-center rounded-full hover:bg-white/5 transition-colors text-[#7b749b]"
                >
                  <List className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center flex-1 my-2">
                
                {/* Spinning Art Container */}
                <div 
                  className={`relative w-[220px] h-[220px] sm:w-[250px] sm:h-[250px] mb-4 sm:mb-6 rounded-full flex flex-col items-center justify-center overflow-hidden border-[3px] shadow-[0_0_20px_rgba(157,78,221,0.3),inset_0_0_15px_rgba(0,180,216,0.2)] transition-all duration-300`}
                  style={{
                    background: 'radial-gradient(circle, #160f33 0%, #09061a 100%)',
                    borderColor: isPlaying ? '#00b4d8' : '#3c1671',
                    boxShadow: isPlaying ? '0 0 35px rgba(157, 78, 221, 0.8), 0 0 70px rgba(0, 180, 216, 0.5), inset 0 0 25px rgba(157, 78, 221, 0.4)' : undefined,
                  }}
                >
                  {/* Rotating wrapper for exactly what needs to spin. 
                      If album cover is available, the cover spins. 
                      If not, the placeholder spins as well to keep the original animation alive. */}
                  <div className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center rounded-full ${isPlaying ? 'animate-spin-slow' : ''}`}>
                      {currentTrack && currentTrack.cover ? (
                        <img 
                          src={currentTrack.cover} 
                          className="w-full h-full object-cover z-20 rounded-full"
                          alt="Cover Art"
                        />
                      ) : (
                        <div className="z-10 flex flex-col items-center pointer-events-none mt-2">
                          <div className="w-0 h-0 border-t-[25px] border-t-transparent border-b-[25px] border-b-transparent border-l-[42px] border-l-[#00b4d8] mb-3 ml-2 drop-shadow-[0_0_8px_rgba(0,180,216,0.5)]"></div>
                          <div className="text-[3.2rem] font-black leading-[0.9] tracking-tighter bg-gradient-to-b from-[#e0aaff] to-[#9d4edd] bg-clip-text text-transparent drop-shadow-md">RF</div>
                          <div className="text-[0.75rem] font-bold tracking-[3px] text-[#00b4d8] uppercase mt-1 flex items-center gap-1.5 drop-shadow-[0_0_5px_rgba(0,180,216,0.5)]">
                            — AUDIO —
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="text-center w-full px-2 mb-5">
                  <div className="text-[1.3rem] font-bold mb-1.5 truncate">
                    {currentTrack ? currentTrack.title : "Nenhuma faixa selecionada"}
                  </div>
                  <div className="text-[0.9rem] text-[#7b749b] truncate">
                    {currentTrack ? currentTrack.artist : "Escolha uma música ou link"}
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full mb-6">
                  <div className="relative w-full h-[20px] flex items-center group">
                    {/* Base Track */}
                    <div className="absolute w-full h-[6px] bg-[#241b4e] rounded-full group-hover:h-[8px] transition-all overflow-hidden pointer-events-none">
                      <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00b4d8] to-[#9d4edd] rounded-full"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    {/* Thumb (Marcador) */}
                    <div 
                      className="absolute w-4 h-4 bg-gradient-to-b from-[#48cae4] to-[#0077b6] rounded-full shadow-[0_0_12px_rgba(0,180,216,0.9)] transform -translate-x-1/2 pointer-events-none transition-transform group-hover:scale-125 group-active:scale-110"
                      style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    >
                      <div className="absolute inset-[3px] bg-[#00b4d8] rounded-full opacity-50" />
                    </div>
                    {/* Range Input for dragging / seeking */}
                    <input 
                      type="range"
                      min="0"
                      max={duration || 100}
                      step="0.01"
                      value={currentTime}
                      onChange={(e) => {
                        const newTime = Number(e.target.value);
                        if (audioRef.current) {
                          audioRef.current.currentTime = newTime;
                        }
                        setCurrentTime(newTime);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
                    />
                  </div>
                  <div className="flex justify-between text-[0.8rem] text-[#7b749b] mt-[-2px]">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Player Controls */}
                <div className="flex justify-between items-center w-full max-w-[280px] mb-4">
                  <button 
                    onClick={() => {
                      const newShuffle = !isShuffle;
                      setIsShuffle(newShuffle);
                      showToast(newShuffle ? "Modo Aleatório Ativado" : "Modo Aleatório desligado");
                    }} 
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isShuffle ? 'text-[#00b4d8] drop-shadow-[0_0_8px_rgba(0,180,216,0.5)]' : 'text-[#7b749b] hover:text-[#9d4edd]'}`}
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                  
                  <button onClick={prevTrack} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-[#9d4edd] transition-colors">
                    <SkipBack className="w-6 h-6 fill-current" />
                  </button>

                  <button 
                    onClick={togglePlay}
                    className="w-[65px] h-[65px] rounded-full bg-gradient-to-br from-[#9d4edd] to-[#5a189a] text-white flex items-center justify-center shadow-[0_4px_20px_rgba(157,78,221,0.4)] hover:scale-105 transition-transform"
                  >
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                  </button>

                  <button onClick={nextTrack} className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:text-[#9d4edd] transition-colors">
                    <SkipForward className="w-6 h-6 fill-current" />
                  </button>

                  <button 
                    onClick={() => {
                      if (repeatMode === "off") {
                        setRepeatMode("all");
                        showToast("Repetir tudo");
                      } else if (repeatMode === "all") {
                        setRepeatMode("one");
                        showToast("Repetir essa Musica");
                      } else {
                        setRepeatMode("off");
                        showToast("Repetir OFF");
                      }
                    }} 
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors relative ${repeatMode !== "off" ? 'text-[#00b4d8] drop-shadow-[0_0_8px_rgba(0,180,216,0.5)]' : 'text-[#7b749b] hover:text-[#9d4edd]'}`}
                  >
                    <Repeat className="w-5 h-5" />
                    {repeatMode === "one" && (
                      <span className="absolute text-[9px] font-bold top-[10px] left-[15px] bg-[#0f0a25] rounded-full w-3 h-3 flex items-center justify-center border border-[#00b4d8]">1</span>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TELA 2: BIBLIOTECA */}
          {currentTab === 'library' && (
            <div className="flex flex-col flex-1 animate-in slide-in-from-bottom-4 duration-300">
              <div className="text-[1.3rem] font-bold mb-4 flex justify-between items-start flex-wrap gap-2">
                <span className="mt-1">Biblioteca</span>
                <div className="flex flex-col gap-1.5 w-auto">
                   <div className="flex gap-1.5 w-full">
                     <label className="border border-[#241b4e] hover:border-[#9d4edd] text-[#f1f1f9] hover:text-[#9d4edd] px-2.5 py-1.5 rounded-lg cursor-pointer text-xs sm:text-sm flex-1 inline-flex justify-center items-center gap-1.5 transition-colors">
                       <Plus className="w-4 h-4"/> <span className="hidden sm:inline">Audio</span><span className="sm:hidden">Áudio</span>
                       <input type="file" accept="audio/*" multiple className="hidden" onChange={handleLocalFiles} />
                     </label>
                       {/* Webkit directory support to select folders */}
                     <label className="border border-[#241b4e] hover:border-[#9d4edd] text-[#f1f1f9] hover:text-[#9d4edd] px-2.5 py-1.5 rounded-lg cursor-pointer text-xs sm:text-sm flex-1 inline-flex justify-center items-center gap-1.5 transition-colors">
                       <FolderPlus className="w-4 h-4"/> Pasta
                       <input type="file" accept="audio/*" multiple {...{ webkitdirectory: "", directory: "" } as any} className="hidden" onChange={handleLocalFiles} />
                     </label>
                   </div>
                   {libraryTab === 'playlists' && !activePlaylistId && (
                     <div className="flex gap-1.5 w-full">
                        <button 
                          onClick={createNewPlaylist}
                          className="flex-1 px-2.5 py-1.5 text-xs font-semibold border border-[#241b4e] hover:border-[#9d4edd] text-[#f1f1f9] hover:text-[#9d4edd] rounded-lg transition-colors flex justify-center items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5"/><span className="whitespace-nowrap">Criar</span>
                        </button>
                        <button 
                          onClick={deleteSelectedPlaylist}
                          disabled={!selectedPlaylistId}
                          className={`flex-1 px-2.5 py-1.5 text-xs font-semibold border rounded-lg transition-colors flex justify-center items-center gap-1.5 ${selectedPlaylistId ? 'border-red-500/50 text-red-500 hover:bg-red-500/10 cursor-pointer' : 'border-[#241b4e] text-[#554d75] cursor-not-allowed'}`}
                        >
                            <Trash2 className="w-3.5 h-3.5"/><span className="whitespace-nowrap">Excluir</span>
                        </button>
                     </div>
                   )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap mb-4 border-b border-[#241b4e] pb-2 items-center justify-between gap-y-2">
                <div className="flex gap-1 sm:gap-2">
                  <button 
                    onClick={() => {setLibraryTab('tracks'); setActivePlaylistId(null); setSelectedPlaylistId(null);}} 
                    className={`px-2 sm:px-3 py-1.5 text-xs sm:text-[0.95rem] rounded-md transition-colors ${libraryTab === 'tracks' ? 'bg-[#9d4edd]/10 text-[#9d4edd] font-semibold' : 'text-[#7b749b] hover:bg-white/5'}`}
                  >
                    Músicas
                  </button>
                  <button 
                    onClick={() => {setLibraryTab('playlists'); setActivePlaylistId(null); setSelectedPlaylistId(null);}} 
                    className={`px-2 sm:px-3 py-1.5 text-xs sm:text-[0.95rem] rounded-md transition-colors ${libraryTab === 'playlists' ? 'bg-[#9d4edd]/10 text-[#9d4edd] font-semibold' : 'text-[#7b749b] hover:bg-white/5'}`}
                  >
                    Playlists
                  </button>
                </div>
              </div>

              {libraryTab === 'tracks' && (
                <div className="flex flex-col flex-1">
                  <div className="relative mb-4">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7b749b]" />
                    <input 
                      type="text" 
                      placeholder="Buscar nas suas faixas..." 
                      className="w-full py-3 pr-4 pl-10 bg-white/5 border border-[#241b4e] rounded-xl text-white outline-none text-sm focus:border-[#9d4edd] transition-colors"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
                    {filteredTracks.length === 0 ? (
                      <div className="text-center p-8 text-[#7b749b]">Nenhum áudio encontrado.</div>
                    ) : (
                      filteredTracks.map((t) => {
                        const globalIndex = tracks.findIndex(track => track.id === t.id);
                        return (
                          <div 
                            key={t.id} 
                            onClick={() => playSpecificTrack(globalIndex)}
                            className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-colors border border-transparent group ${currentTrackIndex === globalIndex ? 'bg-[#9d4edd]/10 border-[#9d4edd]/20' : 'hover:bg-white/5 border-[#241b4e]'}`}
                          >
                            <div className="w-12 h-12 bg-[#160f33] rounded-lg mr-3 flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3c1671]">
                                {t.cover ? <img src={t.cover} className="w-full h-full object-cover" alt="cover"/> : <Play className="w-5 h-5 text-[#9d4edd]/80 ml-1 fill-current"/>}
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="font-semibold text-[0.95rem] truncate mb-0.5" title={t.title}>{t.title}</div>
                              <div className="text-[0.8rem] text-[#7b749b] truncate">{t.artist}</div>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTrack({ id: t.id, title: t.title, artist: t.artist });
                              }}
                              className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-white rounded-full transition-colors flex-shrink-0"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => shareTrack(t, e)}
                              className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-[#00b4d8] hover:bg-[#00b4d8]/10 rounded-full transition-colors flex-shrink-0"
                              title="Compartilhar"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddToPlaylistTrackId(t.id);
                              }}
                              className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-[#9d4edd] hover:bg-[#9d4edd]/10 rounded-full transition-colors flex-shrink-0"
                              title="Mover para Playlist"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => deleteTrack(t.id, e)}
                              className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

               {libraryTab === 'playlists' && !activePlaylistId && (
                <div className="flex flex-col flex-1">
                   {/* Playlists grid */}
                   <div className="grid grid-cols-2 gap-4">
                      <div 
                        className="bg-white/5 border border-[#241b4e] rounded-xl p-4 text-center cursor-pointer hover:-translate-y-1 hover:border-[#9d4edd] transition-all"
                        onClick={() => setActivePlaylistId('favorites')}
                      >
                         <div className="text-[#ef4444] text-[2.2rem] mb-2 flex justify-center"><Heart className="w-8 h-8 fill-current"/></div>
                         <div className="font-bold text-sm">Favoritos</div>
                      </div>
                      
                      {Object.values(playlists).map(pl => (
                        <div 
                          key={pl.id}
                          className={`border rounded-xl p-4 text-center cursor-pointer hover:-translate-y-1 transition-all relative group select-none ${selectedPlaylistId === pl.id ? 'bg-[#9d4edd]/20 border-[#9d4edd]' : 'bg-white/5 border-[#241b4e] hover:border-[#9d4edd]'}`}
                          onPointerDown={(e) => handlePointerDown(pl.id, e)}
                          onPointerUp={handlePointerUpOrLeave}
                          onPointerLeave={handlePointerUpOrLeave}
                          onClick={(e) => handleClickPlaylist(pl.id, e)}
                        >
                           <div className="text-[#00b4d8] text-[2.2rem] mb-2 flex justify-center"><List className={`w-8 h-8 ${selectedPlaylistId === pl.id ? 'text-[#9d4edd]' : ''}`}/></div>
                           <div className="font-bold text-sm truncate px-2">{pl.name}</div>
                           <div className="text-xs text-[#7b749b]">{pl.trackIds.length} faixas</div>
                        </div>
                      ))}
                   </div>
                </div>
              )}

              {libraryTab === 'playlists' && activePlaylistId && activePlaylistId !== 'favorites' && (
                <div className="flex flex-col flex-1">
                   <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => setActivePlaylistId(null)} className="border border-[#241b4e] rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5 hover:text-[#9d4edd] hover:border-[#9d4edd] transition-colors flex-shrink-0"><ArrowLeft className="w-4 h-4"/></button>
                      <input 
                         className="font-bold text-lg bg-transparent border-b border-transparent focus:border-[#9d4edd] outline-none flex-1 truncate transition-colors"
                         value={playlists[activePlaylistId]?.name || ""}
                         onChange={(e) => {
                           setPlaylists({
                             ...playlists,
                             [activePlaylistId]: { ...playlists[activePlaylistId], name: e.target.value }
                           })
                         }}
                      />
                      <label className="bg-gradient-to-br from-[#00b4d8] to-[#9d4edd] text-white w-10 h-10 rounded-xl cursor-pointer flex items-center justify-center shadow-[0_4px_15px_rgba(157,78,221,0.4)] hover:brightness-110 transition-all flex-shrink-0" title="Importar">
                         <Plus className="w-6 h-6 drop-shadow-md"/>
                         <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handlePlaylistImport(e, activePlaylistId)} />
                      </label>
                   </div>
                   
                   <div className="flex flex-col gap-2 overflow-y-auto pr-1 pb-4">
                     {(!playlists[activePlaylistId]?.trackIds || playlists[activePlaylistId].trackIds.length === 0) ? (
                       <div className="text-center p-8 text-[#7b749b]">Nenhum áudio na playlist. <br/><span className="text-xs">Importe um áudio para adicionar.</span></div>
                     ) : (
                       playlists[activePlaylistId].trackIds.map((tid, idx) => {
                          const t = tracks.find(track => track.id === tid);
                          if (!t) return null;
                          const globalIndex = tracks.findIndex(track => track.id === t.id);
                          
                          return (
                            <div 
                              key={`${t.id}_${idx}`} 
                              draggable
                              onDragStart={(e) => handleDragStart(e, idx)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, idx, activePlaylistId)}
                              onClick={() => playSpecificTrack(globalIndex)}
                              className={`flex items-center p-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-colors border border-transparent hover:bg-white/5 ${draggedIdx === idx ? 'opacity-50' : ''}`}
                            >
                              <div className="flex-shrink-0 ml-1 mr-3 flex items-center justify-center relative w-5 h-5" title="Arraste para reordenar">
                                  <div className="absolute inset-0 bg-gradient-to-br from-[#48cae4] to-[#00b4d8] rounded-full blur-[4px] opacity-70"></div>
                                  <div className="w-3.5 h-3.5 bg-gradient-to-br from-[#caf0f8] via-[#00b4d8] to-[#03045e] rounded-full relative z-10 border border-[#48cae4]"></div>
                              </div>
                              <div className="w-12 h-12 bg-[#160f33] rounded-lg mr-3 flex-shrink-0 flex items-center justify-center overflow-hidden border border-[#3c1671]">
                                 {t.cover ? <img src={t.cover} className="w-full h-full object-cover pointer-events-none" alt="cover"/> : <List className="w-5 h-5 text-[#00b4d8] pointer-events-none"/>}
                              </div>
                              <div className="flex-1 min-w-0 pr-2 pointer-events-none">
                                <div className="font-semibold text-[0.95rem] truncate mb-0.5">{t.title}</div>
                                <div className="text-[0.8rem] text-[#7b749b] truncate">{t.artist}</div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTrack({ id: t.id, title: t.title, artist: t.artist });
                                }}
                                className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-white rounded-full transition-colors flex-shrink-0 z-10"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => shareTrack(t, e)}
                                className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-[#00b4d8] hover:bg-[#00b4d8]/10 rounded-full transition-colors flex-shrink-0 z-10"
                                title="Compartilhar"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pl = playlists[activePlaylistId];
                                  const newIds = [...pl.trackIds];
                                  newIds.splice(idx, 1);
                                  setPlaylists({
                                    ...playlists,
                                    [activePlaylistId]: { ...pl, trackIds: newIds }
                                  });
                                }}
                                className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0 z-10"
                                title="Remover da Playlist"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                       })
                     )}
                   </div>
                </div>
              )}
              {libraryTab === 'playlists' && activePlaylistId === 'favorites' && (
                <div className="flex flex-col flex-1">
                   <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => setActivePlaylistId(null)} className="border border-[#241b4e] rounded-lg px-3 py-1.5 text-sm flex items-center gap-1.5 hover:text-[#9d4edd] hover:border-[#9d4edd] transition-colors"><ArrowLeft className="w-4 h-4"/> Voltar</button>
                      <h3 className="font-bold truncate flex-1">Favoritos</h3>
                   </div>
                   <div className="flex flex-col gap-2 overflow-y-auto">
                     {tracks.filter(t => t.isFavorite).length === 0 ? (
                       <div className="text-center p-8 text-[#7b749b]">Nenhum favorito ainda.</div>
                     ) : (
                       tracks.filter(t => t.isFavorite).map((t) => {
                          const globalIndex = tracks.findIndex(track => track.id === t.id);
                          return (
                            <div 
                              key={t.id} 
                              onClick={() => playSpecificTrack(globalIndex)}
                              className={`flex items-center p-2.5 rounded-xl cursor-pointer transition-colors border border-transparent hover:bg-white/5`}
                            >
                              <div className="w-12 h-12 bg-[#160f33] rounded-lg mr-3 flex-shrink-0 overflow-hidden border border-[#3c1671] flex items-center justify-center">
                                 {t.cover ? <img src={t.cover} className="w-full h-full object-cover" alt="cover"/> : <Heart className="w-5 h-5 fill-red-500 text-red-500"/>}
                              </div>
                              <div className="flex-1 min-w-0 pr-2">
                                <div className="font-semibold text-[0.95rem] truncate mb-0.5">{t.title}</div>
                                <div className="text-[0.8rem] text-[#7b749b] truncate">{t.artist}</div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTrack({ id: t.id, title: t.title, artist: t.artist });
                                }}
                                className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-white rounded-full transition-colors flex-shrink-0"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={(e) => shareTrack(t, e)}
                                className="w-8 h-8 flex items-center justify-center text-[#7b749b] hover:text-[#00b4d8] hover:bg-[#00b4d8]/10 rounded-full transition-colors flex-shrink-0 z-10"
                                title="Compartilhar"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                       })
                     )}
                   </div>
                </div>
              )}

            </div>
          )}

          {/* TELA 3: DOWNLOADER/STREAMING */}
          {currentTab === 'downloader' && (
            <div className="flex flex-col flex-1 animate-in slide-in-from-bottom-4 duration-300">
               <div className="text-[1.3rem] font-bold mb-4">URLs & Streaming</div>

               <div className="flex flex-col gap-6 mt-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-[0.85rem] text-[#7b749b] font-semibold flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-[#00b4d8]"/>
                      Reproduzir Link Direto (Streaming)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Cole a URL do áudio (ex: .mp3, .wav)..."
                      className="w-full py-3 px-4 bg-white/5 border border-[#241b4e] rounded-xl text-white outline-none text-sm focus:border-[#9d4edd] transition-colors"
                      value={streamUrl}
                      onChange={(e) => setStreamUrl(e.target.value)}
                    />
                    <button 
                      onClick={playDirectStreamUrl}
                      className="w-full mt-2 py-3.5 rounded-xl border-none bg-gradient-to-r from-[#5a189a] to-[#00b4d8] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(157,78,221,0.3)] hover:brightness-110 transition-all cursor-pointer"
                    >
                       <Play className="w-5 h-5 fill-current"/>
                       Tocar Agora sem baixar
                    </button>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-[#241b4e] to-transparent my-2" />

                  {/* YouTube downloader placeholder */}
                  <div className="flex flex-col gap-2 opacity-50 pointer-events-none">
                    <label className="text-[0.85rem] text-[#7b749b] font-semibold flex items-center gap-2">
                      <Download className="w-4 h-4 text-red-500"/>
                      Baixar do YouTube (Mock/Demo)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Cole o link do vídeo..."
                      className="w-full py-3 px-4 bg-white/5 border border-[#241b4e] rounded-xl text-white outline-none text-sm"
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                    />
                    <button 
                      className="w-full mt-2 py-3.5 rounded-xl border-none bg-gradient-to-r from-[#00b4d8] to-[#9d4edd] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                       Converter Link
                    </button>
                    <div className="text-xs text-[#7b749b] text-center mt-1">
                      A conversão de YouTube requer um backend externo.
                    </div>
                  </div>

               </div>
            </div>
          )}

          {/* TELA 4: COLABORE */}
          {currentTab === 'colabore' && (
            <div className="flex flex-col flex-1 animate-in slide-in-from-bottom-4 duration-300">
               <div className="text-[1.3rem] font-bold mb-4">Colabore no Projeto</div>
               
               <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-[#241b4e]">
                 <p className="text-[0.95rem] leading-relaxed">
                   Gostou do <strong>RF Audio Player</strong> e quer contribuir com o desenvolvimento de novas funções?
                 </p>
                 <p className="text-[0.9rem] text-[#7b749b]">
                   Você pode apoiar o desenvolvedor via Pix utilizando a chave abaixo:
                 </p>

                 <div className="flex flex-col gap-1.5 mt-2">
                   <label className="text-[0.85rem] text-[#7b749b] font-semibold">Chave Pix (E-mail)</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       value="renato.rcc@hotmail.com" 
                       readOnly
                       className="flex-1 py-3 px-4 bg-black/30 border border-[#241b4e] rounded-xl text-[#00b4d8] font-bold text-center outline-none text-sm"
                     />
                     <button 
                       onClick={() => {
                         if (navigator.clipboard && navigator.clipboard.writeText) {
                           navigator.clipboard.writeText("renato.rcc@hotmail.com").then(() => {
                             showToast("Pix copiado!");
                           }).catch(err => {
                             showToast("Não foi possível copiar o Pix.");
                             console.error("Clipboard error:", err);
                           });
                         } else {
                           showToast("Não foi possível copiar o Pix neste dispositivo.");
                         }
                       }}
                       className="px-4 border border-[#241b4e] rounded-xl hover:border-[#9d4edd] hover:text-[#9d4edd] transition-colors flex items-center justify-center cursor-pointer"
                     >
                        <Copy className="w-5 h-5"/>
                     </button>
                   </div>
                 </div>
               </div>
            </div>
          )}

        </div>

        {/* Modal de Edição */}
        {editingTrack && (
          <div className="absolute inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#160f33] w-full max-w-[320px] rounded-2xl border border-[#3c1671] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              <h3 className="font-bold text-lg">Editar Música</h3>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[#7b749b]">Nome da Música</label>
                <input 
                  type="text" 
                  value={editingTrack.title}
                  onChange={e => setEditingTrack({...editingTrack, title: e.target.value})}
                  className="w-full py-2 px-3 bg-black/30 border border-[#241b4e] rounded-lg text-white outline-none text-sm focus:border-[#9d4edd] transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[#7b749b]">Autor / Artista</label>
                <input 
                  type="text" 
                  value={editingTrack.artist}
                  onChange={e => setEditingTrack({...editingTrack, artist: e.target.value})}
                  className="w-full py-2 px-3 bg-black/30 border border-[#241b4e] rounded-lg text-white outline-none text-sm focus:border-[#9d4edd] transition-colors"
                />
              </div>

              <div className="flex gap-3 justify-end mt-2">
                <button 
                  onClick={() => setEditingTrack(null)}
                  className="px-4 py-2 text-sm text-[#7b749b] hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={saveTrackEdit}
                  className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-[#9d4edd] to-[#5a189a] rounded-lg text-white shadow-[0_4px_10px_rgba(157,78,221,0.3)] hover:opacity-90 transition-opacity"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Mover para Playlist */}
        {addToPlaylistTrackId && (
          <div className="absolute inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#160f33] w-full max-w-[320px] max-h-[80vh] rounded-2xl border border-[#3c1671] p-5 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
              <h3 className="font-bold text-lg">Mover para Playlist</h3>
              
              <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                {Object.values(playlists).length === 0 && (
                   <div className="text-center p-4 text-[#7b749b] text-sm">Nenhuma playlist criada.</div>
                )}
                {Object.values(playlists).map(pl => (
                   <div 
                     key={pl.id}
                     onClick={() => addTrackToSelectedPlaylist(pl.id)}
                     className="flex items-center gap-3 p-3 rounded-xl cursor-pointer bg-white/5 border border-[#241b4e] hover:border-[#9d4edd] transition-all"
                   >
                     <List className="w-5 h-5 text-[#00b4d8]" />
                     <div className="font-semibold text-sm truncate flex-1">{pl.name}</div>
                   </div>
                ))}
              </div>

              <div className="flex justify-end mt-2 pt-2 border-t border-[#241b4e]">
                <button 
                  onClick={() => setAddToPlaylistTrackId(null)}
                  className="px-4 py-2 text-sm text-[#7b749b] hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- BOTTOM NAVIGATION --- */}
        <nav className="absolute bottom-0 left-0 right-0 h-[75px] bg-[#0f0b21]/85 backdrop-blur-md border-t border-[#241b4e] flex justify-around items-center z-10">
           <button 
             onClick={() => setCurrentTab('player')}
             className={`flex flex-col items-center gap-1.5 w-16 text-[0.75rem] transition-colors cursor-pointer ${currentTab === 'player' ? 'text-[#9d4edd] drop-shadow-[0_0_10px_rgba(157,78,221,0.4)]' : 'text-[#7b749b] hover:text-white'}`}
           >
             <Play className={`w-6 h-6 ${currentTab === 'player' ? 'fill-current' : ''}`} />
             <span>Player</span>
           </button>
           <button 
             onClick={() => setCurrentTab('library')}
             className={`flex flex-col items-center gap-1.5 w-16 text-[0.75rem] transition-colors cursor-pointer ${currentTab === 'library' ? 'text-[#9d4edd] drop-shadow-[0_0_10px_rgba(157,78,221,0.4)]' : 'text-[#7b749b] hover:text-white'}`}
           >
             <Folder className={`w-6 h-6 ${currentTab === 'library' ? 'fill-current' : ''}`} />
             <span>Biblioteca</span>
           </button>
           <button 
             onClick={() => setCurrentTab('downloader')}
             className={`flex flex-col items-center gap-1.5 w-16 text-[0.75rem] transition-colors cursor-pointer ${currentTab === 'downloader' ? 'text-[#9d4edd] drop-shadow-[0_0_10px_rgba(157,78,221,0.4)]' : 'text-[#7b749b] hover:text-white'}`}
           >
             <LinkIcon className={`w-6 h-6 ${currentTab === 'downloader' ? 'stroke-[2.5px]' : ''}`} />
             <span>URLs</span>
           </button>
           <button 
             onClick={() => setCurrentTab('colabore')}
             className={`flex flex-col items-center gap-1.5 w-16 text-[0.75rem] transition-colors cursor-pointer ${currentTab === 'colabore' ? 'text-[#9d4edd] drop-shadow-[0_0_10px_rgba(157,78,221,0.4)]' : 'text-[#7b749b] hover:text-white'}`}
           >
             <Heart className={`w-6 h-6 ${currentTab === 'colabore' ? 'fill-current' : ''}`} />
             <span>Colabore</span>
           </button>
        </nav>

        {/* Global Keyframes definitions for Spin */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spinSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin-slow {
            animation: spinSlow 25s linear infinite;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #3c1671;
            border-radius: 4px;
          }
        `}} />
      </div>
    </div>
  );
}
