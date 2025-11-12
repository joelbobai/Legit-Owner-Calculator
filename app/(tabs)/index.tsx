import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Operator = '+' | '-' | '×' | '÷';

type MemoryAction = 'MC' | 'MR' | 'M+' | 'M-' | 'MS' | 'Mv';

type CalculatorButton = {
  label: string;
  type: 'digit' | 'decimal' | 'operator' | 'command';
  action?: Operator | '±' | '=' | '%' | 'CE' | 'C' | '⌫' | '1/x' | 'x²' | '√x';
};

const SIDEBAR_WIDTH = 280;

type SidebarSection = {
  title: string;
  items: { label: string; icon: string }[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Calculator',
    items: [
      { label: 'Standard', icon: '🧮' },
      { label: 'Scientific', icon: '🧪' },
      { label: 'Graphing', icon: '📈' },
      { label: 'Programmer', icon: '💻' },
      { label: 'Date calculation', icon: '📅' },
    ],
  },
  {
    title: 'Converter',
    items: [
      { label: 'Currency', icon: '💱' },
      { label: 'Volume', icon: '🧴' },
      { label: 'Length', icon: '📏' },
      { label: 'Weight and mass', icon: '⚖️' },
      { label: 'Temperature', icon: '🌡️' },
      { label: 'Energy', icon: '🔋' },
      { label: 'Area', icon: '📐' },
      { label: 'Speed', icon: '🚀' },
      { label: 'Time', icon: '⏱️' },
    ],
  },
];

const SIDEBAR_FOOTER = { label: 'Settings', icon: '⚙️' };

const BUTTON_GROUPS: CalculatorButton[][] = [
  [
    { label: '%', type: 'command', action: '%' },
    { label: 'CE', type: 'command', action: 'CE' },
    { label: 'C', type: 'command', action: 'C' },
    { label: '⌫', type: 'command', action: '⌫' },
  ],
  [
    { label: '1/x', type: 'command', action: '1/x' },
    { label: 'x²', type: 'command', action: 'x²' },
    { label: '√x', type: 'command', action: '√x' },
    { label: '÷', type: 'operator', action: '÷' },
  ],
  [
    { label: '7', type: 'digit' },
    { label: '8', type: 'digit' },
    { label: '9', type: 'digit' },
    { label: '×', type: 'operator', action: '×' },
  ],
  [
    { label: '4', type: 'digit' },
    { label: '5', type: 'digit' },
    { label: '6', type: 'digit' },
    { label: '-', type: 'operator', action: '-' },
  ],
  [
    { label: '1', type: 'digit' },
    { label: '2', type: 'digit' },
    { label: '3', type: 'digit' },
    { label: '+', type: 'operator', action: '+' },
  ],
  [
    { label: '±', type: 'command', action: '±' },
    { label: '0', type: 'digit' },
    { label: '.', type: 'decimal' },
    { label: '=', type: 'command', action: '=' },
  ],
];

type MemoryEntry = {
  id: string;
  value: number;
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return 'Cannot divide by zero';
  }

  const absValue = Math.abs(value);
  if (absValue !== 0 && (absValue >= 1e12 || absValue < 1e-9)) {
    return value.toExponential(6).replace(/\+/, '');
  }

  const [integerPart, decimalPart] = value.toString().split('.');
  const formattedInteger = parseInt(integerPart, 10)
    .toLocaleString('en-US')
    .replace(/\u202F/g, ',');

  if (!decimalPart) {
    return formattedInteger;
  }

  return `${formattedInteger}.${decimalPart}`;
};

const parseDisplayValue = (displayValue: string) => {
  if (displayValue === 'Cannot divide by zero') {
    return NaN;
  }

  return Number(displayValue.replace(/,/g, ''));
};

const isNumericEntry = (value: string) => /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, ''));

const createMemoryEntry = (value: number): MemoryEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  value,
});

export default function HomeScreen() {
  const [displayValue, setDisplayValue] = useState('0');
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [memoryExpanded, setMemoryExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState({ category: 'Calculator', label: 'Standard' });

  const sidebarAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sidebarAnimation, {
      toValue: sidebarOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarAnimation]);

  const sidebarTranslate = sidebarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-SIDEBAR_WIDTH, 0],
  });

  const overlayOpacity = sidebarAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const handleSelectSidebarItem = (category: string, label: string) => {
    setActiveSection({ category, label });
    setSidebarOpen(false);
  };

  const handleDigitPress = (digit: string) => {
    setDisplayValue((prev) => {
      if (!isNumericEntry(prev) || waitingForOperand) {
        setWaitingForOperand(false);
        return digit;
      }

      if (prev === '0') {
        return digit;
      }

      return `${prev}${digit}`;
    });
  };

  const handleDecimalPress = () => {
    setDisplayValue((prev) => {
      if (!isNumericEntry(prev)) {
        setWaitingForOperand(false);
        return '0.';
      }

      if (waitingForOperand) {
        setWaitingForOperand(false);
        return '0.';
      }

      if (prev.includes('.')) {
        return prev;
      }

      return `${prev}.`;
    });
  };

  const performOperation = (operator: Operator, left: number, right: number) => {
    switch (operator) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '×':
        return left * right;
      case '÷':
        return right === 0 ? Infinity : left / right;
      default:
        return right;
    }
  };

  const commitValue = (value: number) => {
    if (!Number.isFinite(value)) {
      setDisplayValue('Cannot divide by zero');
      setStoredValue(null);
      setPendingOperator(null);
      setWaitingForOperand(false);
      return;
    }

    const roundedValue = Math.round((value + Number.EPSILON) * 1e12) / 1e12;
    setDisplayValue(formatNumber(roundedValue));
  };

  const handleOperatorPress = (operator: Operator) => {
    const currentValue = parseDisplayValue(displayValue);

    if (!Number.isFinite(currentValue)) {
      return;
    }

    if (storedValue === null || pendingOperator === null) {
      setStoredValue(currentValue);
    } else if (!waitingForOperand) {
      const computed = performOperation(pendingOperator, storedValue, currentValue);
      if (!Number.isFinite(computed)) {
        commitValue(computed);
        return;
      }
      setStoredValue(computed);
      setDisplayValue(formatNumber(computed));
    }

    setPendingOperator(operator);
    setWaitingForOperand(true);
  };

  const handleEqualsPress = () => {
    if (pendingOperator === null || storedValue === null) {
      return;
    }

    const currentValue = parseDisplayValue(displayValue);
    if (!Number.isFinite(currentValue)) {
      return;
    }

    const result = performOperation(pendingOperator, storedValue, currentValue);
    commitValue(result);
    if (Number.isFinite(result)) {
      setStoredValue(result);
    }
    setWaitingForOperand(true);
  };

  const handlePercent = () => {
    const currentValue = parseDisplayValue(displayValue);
    if (!Number.isFinite(currentValue)) {
      return;
    }

    let percentage = currentValue / 100;

    if (storedValue !== null && pendingOperator !== null) {
      percentage = (storedValue * currentValue) / 100;
    }

    commitValue(percentage);
    setWaitingForOperand(true);
  };

  const handleUnaryCommand = (command: '±' | '1/x' | 'x²' | '√x') => {
    const currentValue = parseDisplayValue(displayValue);
    if (!Number.isFinite(currentValue)) {
      return;
    }

    switch (command) {
      case '±':
        commitValue(-currentValue);
        break;
      case '1/x':
        if (currentValue === 0) {
          commitValue(Infinity);
        } else {
          commitValue(1 / currentValue);
        }
        break;
      case 'x²':
        commitValue(currentValue * currentValue);
        break;
      case '√x':
        if (currentValue < 0) {
          setDisplayValue('Invalid input');
          setStoredValue(null);
          setPendingOperator(null);
          setWaitingForOperand(false);
        } else {
          commitValue(Math.sqrt(currentValue));
        }
        break;
    }
  };

  const handleClearEntry = () => {
    setDisplayValue('0');
    setWaitingForOperand(true);
  };

  const handleClearAll = () => {
    setDisplayValue('0');
    setStoredValue(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    setDisplayValue((prev) => {
      if (!isNumericEntry(prev)) {
        return '0';
      }

      if (prev.length <= 1) {
        return '0';
      }

      const next = prev.slice(0, -1);
      return next === '-' || next === '' ? '0' : next;
    });
  };

  const handleCommand = (action: NonNullable<CalculatorButton['action']>) => {
    switch (action) {
      case '=':
        handleEqualsPress();
        break;
      case '%':
        handlePercent();
        break;
      case 'CE':
        handleClearEntry();
        break;
      case 'C':
        handleClearAll();
        break;
      case '⌫':
        handleBackspace();
        break;
      case '±':
      case '1/x':
      case 'x²':
      case '√x':
        handleUnaryCommand(action);
        break;
    }
  };

  const handleMemoryAction = (action: MemoryAction) => {
    const numericDisplay = parseDisplayValue(displayValue);
    switch (action) {
      case 'MC':
        setMemoryEntries([]);
        setMemoryExpanded(false);
        break;
      case 'MR':
        if (memoryEntries.length > 0) {
          commitValue(memoryEntries[0].value);
          setWaitingForOperand(true);
        }
        break;
      case 'M+':
        if (memoryEntries.length === 0) {
          setMemoryEntries([createMemoryEntry(numericDisplay || 0)]);
        } else {
          const [first, ...rest] = memoryEntries;
          const updated = { ...first, value: first.value + (numericDisplay || 0) };
          setMemoryEntries([updated, ...rest]);
        }
        break;
      case 'M-':
        if (memoryEntries.length === 0) {
          setMemoryEntries([createMemoryEntry(-(numericDisplay || 0))]);
        } else {
          const [first, ...rest] = memoryEntries;
          const updated = { ...first, value: first.value - (numericDisplay || 0) };
          setMemoryEntries([updated, ...rest]);
        }
        break;
      case 'MS':
        setMemoryEntries((entries) => [createMemoryEntry(numericDisplay || 0), ...entries]);
        break;
      case 'Mv':
        setMemoryExpanded((expanded) => !expanded);
        break;
    }
  };

  const formattedDisplay = useMemo(() => {
    if (displayValue === 'Cannot divide by zero' || displayValue === 'Invalid input') {
      return displayValue;
    }

    const numericValue = parseDisplayValue(displayValue);
    if (!Number.isFinite(numericValue)) {
      return displayValue;
    }

    if (Number.isInteger(numericValue)) {
      return formatNumber(numericValue);
    }

    const [integerPart, decimalPart = ''] = displayValue.split('.');
    const sanitizedInteger = integerPart.replace(/,/g, '');
    const formattedInteger = Number(sanitizedInteger).toLocaleString('en-US');
    return `${formattedInteger}.${decimalPart}`;
  }, [displayValue]);

  const handleButtonPress = (
    button: CalculatorButton,
  ) => (event: GestureResponderEvent) => {
    event.preventDefault?.();

    if (button.type === 'digit') {
      handleDigitPress(button.label);
      return;
    }

    if (button.type === 'decimal') {
      handleDecimalPress();
      return;
    }

    if (button.type === 'operator' && button.action) {
      handleOperatorPress(button.action as Operator);
      return;
    }

    if (button.type === 'command' && button.action) {
      handleCommand(button.action);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle navigation menu"
              onPress={() => setSidebarOpen(true)}
              style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconPressed]}
            >
              <Text style={styles.menuIcon}>☰</Text>
            </Pressable>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>{activeSection.label}</Text>
              <Text style={styles.headerSubtitle}>{activeSection.category}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open history"
              style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconPressed]}
            >
              <Text style={styles.historyIcon}>🕘</Text>
            </Pressable>
          </View>

          <View style={styles.memoryRow}>
            {(['MC', 'MR', 'M+', 'M-', 'MS', 'Mv'] as MemoryAction[]).map((action) => {
              const isActive = action === 'Mv' && memoryExpanded;
              return (
                <Pressable
                  key={action}
                  onPress={() => handleMemoryAction(action)}
                  style={[styles.memoryButton, isActive && styles.memoryButtonActive]}
                  android_ripple={{ color: '#c9c9c9', borderless: false }}
                >
                  <Text style={styles.memoryButtonLabel}>{action}</Text>
                </Pressable>
              );
            })}
          </View>

          {memoryExpanded && (
            <View style={styles.memoryContainer}>
              <Text style={styles.memoryTitle}>Memory</Text>
              {memoryEntries.length === 0 ? (
                <Text style={styles.memoryEmpty}>{"There's nothing saved in memory"}</Text>
              ) : (
                memoryEntries.map((entry) => (
                  <View key={entry.id} style={styles.memoryEntry}>
                    <Text style={styles.memoryEntryValue}>{formatNumber(entry.value)}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={styles.displayContainer}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
              style={styles.displayText}
            >
              {formattedDisplay}
            </Text>
          </View>

          <View style={styles.buttonsContainer}>
            {BUTTON_GROUPS.map((group, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.buttonRow}>
                {group.map((button) => {
                  const isEquals = button.label === '=';
                  const isOperator = button.type === 'operator' || isEquals;
                  return (
                    <Pressable
                      key={button.label}
                      onPress={handleButtonPress(button)}
                      style={({ pressed }) => [
                        styles.button,
                        isOperator && styles.operatorButton,
                        isEquals && styles.equalsButton,
                        pressed && styles.buttonPressed,
                      ]}
                      android_ripple={{ color: '#c9c9c9', borderless: false }}
                    >
                      <Text
                        style={[styles.buttonLabel, isOperator && styles.operatorLabel, isEquals && styles.equalsLabel]}
                      >
                        {button.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <Animated.View
        pointerEvents={sidebarOpen ? 'auto' : 'none'}
        style={[styles.sidebarOverlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} />
      </Animated.View>
      <Animated.View
        style={[styles.sidebarContainer, { transform: [{ translateX: sidebarTranslate }] }]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarHeaderTitle}>Calculator</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.sidebarScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {SIDEBAR_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sidebarSection}>
              <Text style={styles.sidebarSectionTitle}>{section.title}</Text>
              {section.items.map((item) => {
                const isActive =
                  activeSection.category === section.title && activeSection.label === item.label;
                return (
                  <Pressable
                    key={item.label}
                    onPress={() => handleSelectSidebarItem(section.title, item.label)}
                    style={({ pressed }) => [
                      styles.sidebarItem,
                      isActive && styles.sidebarItemActive,
                      pressed && styles.sidebarItemPressed,
                    ]}
                  >
                    <Text style={styles.sidebarItemIcon}>{item.icon}</Text>
                    <Text style={[styles.sidebarItemLabel, isActive && styles.sidebarItemLabelActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => handleSelectSidebarItem('Settings', SIDEBAR_FOOTER.label)}
          style={({ pressed }) => [
            styles.sidebarFooter,
            activeSection.category === 'Settings' && styles.sidebarItemActive,
            pressed && styles.sidebarItemPressed,
          ]}
        >
          <Text style={styles.sidebarItemIcon}>{SIDEBAR_FOOTER.icon}</Text>
          <Text
            style={[
              styles.sidebarItemLabel,
              activeSection.category === 'Settings' && styles.sidebarItemLabelActive,
            ]}
          >
            {SIDEBAR_FOOTER.label}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6efe6',
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  menuIcon: {
    fontSize: 20,
    color: '#3b3b3b',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPressed: {
    backgroundColor: '#e9e1d7',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3b3b3b',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#7f7f7f',
  },
  historyIcon: {
    fontSize: 18,
    color: '#3b3b3b',
  },
  memoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  memoryButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f7f3ed',
    alignItems: 'center',
  },
  memoryButtonActive: {
    backgroundColor: '#e9e1d7',
  },
  memoryButtonLabel: {
    fontSize: 14,
    color: '#5c5c5c',
    fontWeight: '500',
  },
  memoryContainer: {
    borderRadius: 16,
    backgroundColor: '#fdf8f2',
    padding: 16,
    gap: 12,
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b3b3b',
  },
  memoryEmpty: {
    fontSize: 14,
    color: '#7f7f7f',
  },
  memoryEntry: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd3c7',
  },
  memoryEntryValue: {
    fontSize: 18,
    color: '#3b3b3b',
    fontWeight: '500',
  },
  displayContainer: {
    alignItems: 'flex-end',
    paddingVertical: 32,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#fefcfa',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    minHeight: 120,
  },
  displayText: {
    fontSize: 64,
    fontWeight: '300',
    color: '#1f1f1f',
  },
  buttonsContainer: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#fefefe',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  buttonPressed: {
    backgroundColor: '#e9e1d7',
  },
  buttonLabel: {
    fontSize: 24,
    color: '#3b3b3b',
    fontWeight: '500',
  },
  operatorButton: {
    backgroundColor: '#f4ece4',
  },
  operatorLabel: {
    color: '#1f1f1f',
  },
  equalsButton: {
    backgroundColor: '#1376f4',
  },
  equalsLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  sidebarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#121212',
    zIndex: 20,
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: '#fefefe',
    paddingTop: 48,
    paddingBottom: 24,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  sidebarHeader: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e0da',
  },
  sidebarHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  sidebarScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 24,
  },
  sidebarSection: {
    gap: 8,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#7f7f7f',
    paddingHorizontal: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  sidebarItemPressed: {
    backgroundColor: '#efe8de',
  },
  sidebarItemActive: {
    backgroundColor: '#e8f0fe',
  },
  sidebarItemIcon: {
    fontSize: 18,
  },
  sidebarItemLabel: {
    fontSize: 16,
    color: '#3b3b3b',
    flexShrink: 1,
  },
  sidebarItemLabelActive: {
    fontWeight: '600',
    color: '#1f1f1f',
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e4e0da',
    gap: 12,
  },
});
