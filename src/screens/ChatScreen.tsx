import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Keyboard,
  Modal,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useChatStore } from '../store/useChatStore';
import { useAppStore } from '../store/useAppStore';
import { Message } from '../types/chat';
import ChatRepository from '../services/database/ChatRepository';
import LLMService from '../services/llm/LLMService';
import ChatBubble from '../components/chat/ChatBubble';
import TypingIndicator from '../components/chat/TypingIndicator';
import ThinkingBanner from '../components/chat/ThinkingBanner';
import QuickPrompts from '../components/chat/QuickPrompts';

type ChatPhase = 'idle' | 'loading_model' | 'waiting' | 'streaming';

export default function ChatScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = React.useState('');
  const [chatPhase, setChatPhase] = React.useState<ChatPhase>('idle');
  const [menuVisible, setMenuVisible] = React.useState(false);
  // Scroll tracking
  const userScrolledUp = useRef(false);
  const isAutoScrolling = useRef(false);

  const {
    currentConversation,
    messages,
    isGenerating,
    streamingText,
    setCurrentConversation,
    setMessages,
    addMessage,
    setIsGenerating,
    setStreamingText,
    appendStreamingToken,
    clearStreamingText,
    clearChat,
  } = useChatStore();

  useFocusEffect(
    useCallback(() => {
      loadConversation();
    }, []),
  );

  const loadConversation = async () => {
    try {
      const latest = await ChatRepository.getLatestConversation();
      if (latest) {
        setCurrentConversation(latest);
        const msgs = await ChatRepository.getMessages(latest.id);
        setMessages(msgs);
      }
    } catch (err) {
      console.warn('[ChatScreen] Failed to load conversation:', err);
    }
  };

  const ensureModelReady = async (): Promise<boolean> => {
    if (LLMService.isReady()) return true;
    try {
      setChatPhase('loading_model');
      useAppStore.getState().setModelStatus('loading');
      await LLMService.initialize();
      useAppStore.getState().setModelStatus('ready');
      return true;
    } catch (err) {
      console.warn('[ChatScreen] Failed to initialize model:', err);
      setChatPhase('idle');
      return false;
    }
  };

  const handleSend = async (text?: string) => {
    const content = (text || inputText).trim();
    if (!content || isGenerating) return;

    setInputText('');
    Keyboard.dismiss();
    userScrolledUp.current = false;

    try {
      let convo = currentConversation;
      if (!convo) {
        convo = await ChatRepository.createConversation();
        setCurrentConversation(convo);
      }

      const userMsg = await ChatRepository.addMessage(convo.id, 'user', content);
      addMessage(userMsg);
      doScrollToBottom(true);

      const msgCount = await ChatRepository.getMessageCount(convo.id);
      if (msgCount === 1) {
        const title = content.length > 40 ? content.slice(0, 40) + '...' : content;
        await ChatRepository.updateConversationTitle(convo.id, title);
      }

      const ready = await ensureModelReady();
      if (!ready) {
        const fallback = await ChatRepository.addMessage(
          convo.id, 'assistant',
          'I need a moment to get ready. Please try again in a few seconds.',
        );
        addMessage(fallback);
        setChatPhase('idle');
        return;
      }

      // Show typing dots while waiting for first token
      setIsGenerating(true);
      clearStreamingText();
      setChatPhase('waiting');

      let gotFirstToken = false;
      const allMessages = useChatStore.getState().messages;

      let fullText = '';
      try {
        fullText = await LLMService.chat(allMessages, (token) => {
          if (!gotFirstToken) {
            gotFirstToken = true;
            setChatPhase('streaming');
          }
          appendStreamingToken(token);
        });
      } catch (chatErr: any) {
        // Context may have been released (e.g. app backgrounded).
        // Salvage whatever was streamed so the user doesn't lose the partial response.
        console.warn('[ChatScreen] Chat interrupted:', chatErr);
      }

      // Use fullText from LLM, or fall back to what was streamed
      const streamedSoFar = useChatStore.getState().streamingText.trim();
      const finalText = (fullText || '').trim() || streamedSoFar;

      setIsGenerating(false);
      clearStreamingText();
      setChatPhase('idle');

      if (finalText) {
        const aiMsg = await ChatRepository.addMessage(convo.id, 'assistant', finalText);
        addMessage(aiMsg);
        doScrollToBottom(true);
      }
    } catch (err: any) {
      console.warn('[ChatScreen] Generation error:', err);
      // Salvage any partial streamed text on unexpected errors
      const partial = useChatStore.getState().streamingText.trim();
      setIsGenerating(false);
      clearStreamingText();
      setChatPhase('idle');

      if (partial && currentConversation) {
        try {
          const aiMsg = await ChatRepository.addMessage(
            currentConversation.id, 'assistant', partial,
          );
          addMessage(aiMsg);
        } catch {}
      }
    }
  };

  const handleStop = async () => {
    try { await LLMService.stopCompletion(); } catch {}
    setIsGenerating(false);
    const partial = useChatStore.getState().streamingText.trim();
    clearStreamingText();
    setChatPhase('idle');

    if (partial && currentConversation) {
      const aiMsg = await ChatRepository.addMessage(
        currentConversation.id, 'assistant', partial,
      );
      addMessage(aiMsg);
    }
  };

  const handleNewChat = () => {
    setMenuVisible(false);
    clearChat();
    setChatPhase('idle');
  };

  // ── Scroll helpers ──

  const doScrollToBottom = (animated: boolean) => {
    isAutoScrolling.current = true;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
      setTimeout(() => { isAutoScrolling.current = false; }, 200);
    }, 50);
  };

  // Auto-scroll on new streaming content — only if user hasn't scrolled up
  useEffect(() => {
    if (streamingText && !userScrolledUp.current) {
      flatListRef.current?.scrollToEnd({ animated: false });
    }
  }, [streamingText]);

  const handleScrollBeginDrag = () => {
    // User started touching/dragging — they want control
    if (isGenerating) {
      userScrolledUp.current = true;
    }
  };

  const handleScrollEndDrag = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    // If user scrolled back near bottom, resume auto-scroll
    if (distanceFromBottom < 80) {
      userScrolledUp.current = false;
    }
  };

  // ── Display data ──

  const displayData: Array<
    | { type: 'message'; data: Message }
    | { type: 'streaming'; data: string }
    | { type: 'loading'; label: string }
    | { type: 'typing' }
  > = messages.map((m) => ({ type: 'message' as const, data: m }));

  if (chatPhase === 'loading_model') {
    displayData.push({ type: 'loading', label: 'Loading AI model...' });
  } else if (chatPhase === 'waiting') {
    displayData.push({ type: 'typing' });
  } else if (chatPhase === 'streaming' && streamingText) {
    displayData.push({ type: 'streaming', data: streamingText });
  } else if (chatPhase === 'streaming' && !streamingText) {
    // Still streaming phase but no text yet — show dots
    displayData.push({ type: 'typing' });
  }

  const renderItem = ({ item }: { item: (typeof displayData)[number] }) => {
    if (item.type === 'loading') {
      return <ThinkingBanner label={item.label} />;
    }
    if (item.type === 'typing') {
      return (
        <View style={styles.messageWrapper}>
          <TypingIndicator />
        </View>
      );
    }
    if (item.type === 'streaming') {
      return (
        <View style={styles.messageWrapper}>
          <ChatBubble content={item.data} isUser={false} isStreaming />
        </View>
      );
    }
    return (
      <View style={styles.messageWrapper}>
        <ChatBubble content={item.data.content} isUser={item.data.role === 'user'} />
      </View>
    );
  };

  const isEmpty = messages.length === 0 && chatPhase === 'idle';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <Icon name="arrow-left" size={22} color="#2C2926" />
            </Pressable>
            <Text style={styles.headerTitle}>MindSafe</Text>
          </View>
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={12}>
            <Icon name="dots-vertical" size={22} color="#2C2926" />
          </Pressable>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={displayData}
        renderItem={renderItem}
        keyExtractor={(item, index) => {
          if (item.type === 'message') return item.data.id;
          return `${item.type}-${index}`;
        }}
        contentContainerStyle={[
          styles.listContent,
          isEmpty && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          if (messages.length > 0 && !userScrolledUp.current && !isAutoScrolling.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        ListEmptyComponent={
          chatPhase === 'idle' ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyCircle}>
                <Icon name="chat-outline" size={40} color="#908981" />
              </View>
              <Text style={styles.emptyHeading}>Begin the dialogue</Text>
              <Text style={styles.emptyDescription}>
                MindSafe is a private space to talk through whatever is on your
                mind. Your thoughts never leave this device.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <QuickPrompts onSelect={(prompt) => handleSend(prompt)} />
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Write something..."
            placeholderTextColor="rgba(144,137,129,0.6)"
            value={inputText}
            onChangeText={setInputText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={() => handleSend()}
            editable={chatPhase === 'idle'}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendButtonPressed,
            ]}
            onPress={() => (isGenerating ? handleStop() : handleSend())}
          >
            <Icon
              name={isGenerating ? 'stop' : 'arrow-up'}
              size={22}
              color={isGenerating ? '#BF7A5B' : inputText.trim() ? '#3D6B4F' : '#908981'}
            />
          </Pressable>
        </View>
      </View>

      {/* Chat Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuPopover, { top: insets.top + 48, right: 16 }]}>
            <Pressable
              style={styles.menuItem}
              onPress={handleNewChat}
            >
              <Icon name="chat-plus-outline" size={18} color="#2C2926" />
              <Text style={styles.menuItemText}>New conversation</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { backgroundColor: '#FFFFFF' },
  headerInner: {
    height: 56, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerTitle: { fontSize: 16, fontWeight: '500', color: '#2C2926' },

  listContent: { paddingHorizontal: 20, paddingVertical: 24 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  messageWrapper: { marginBottom: 32 },

  emptyContainer: { alignItems: 'center', gap: 16 },
  emptyCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#F0ECE4', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  emptyHeading: { fontSize: 20, fontWeight: '500', color: '#2C2926' },
  emptyDescription: {
    fontSize: 14, color: '#908981', textAlign: 'center', maxWidth: 280, lineHeight: 21,
  },

  footer: { backgroundColor: '#FFFFFF', paddingTop: 16 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0ECE4',
    borderRadius: 12, height: 56, paddingHorizontal: 16, marginHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  input: { flex: 1, fontSize: 15, color: '#2C2926', paddingVertical: 0 },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  sendButtonPressed: { backgroundColor: 'rgba(255,255,255,0.5)', transform: [{ scale: 0.92 }] },

  // Menu modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  menuPopover: {
    position: 'absolute', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4,
    minWidth: 200,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8,
  },
  menuItemText: { fontSize: 15, fontWeight: '400', color: '#2C2926' },
});
