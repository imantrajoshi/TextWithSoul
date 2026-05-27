import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../services/socketService';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }

    const socket = connectSocket(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Set initial state
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [isAuthenticated, token]);

  const emit = useCallback((event, data) => {
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    const socket = getSocket();
    if (socket) {
      socket.on(event, handler);
    }
    return () => {
      const s = getSocket();
      if (s) s.off(event, handler);
    };
  }, []);

  const off = useCallback((event, handler) => {
    const socket = getSocket();
    if (socket) {
      socket.off(event, handler);
    }
  }, []);

  const value = {
    isConnected,
    emit,
    on,
    off,
    getSocket,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
