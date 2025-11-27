import { useMemo, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Operator = '+' | '-' | '×' | '÷';

type MemoryAction = 'MC' | 'MR' | 'M+' | 'M-' | 'MS' | 'Mv';

type CalculatorButton = {
  label: string;
  type: 'digit' | 'decimal' | 'operator' | 'command';
  action?: Operator | '±' | '=' | '%' | 'CE' | 'C' | '⌫' | '1/x' | 'x²' | '√x';
};

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
  const [completedExpression, setCompletedExpression] = useState<string | null>(null);

  const handleDigitPress = (digit: string) => {
    setCompletedExpression(null);
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
    setCompletedExpression(null);
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

    setCompletedExpression(null);

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
    setCompletedExpression(
      `${formatNumber(storedValue)} ${pendingOperator} ${formatNumber(currentValue)} =`,
    );
    setWaitingForOperand(true);
  };

  const handlePercent = () => {
    setCompletedExpression(null);

    const currentValue = parseDisplayValue(displayValue);
    if (!Number.isFinite(currentValue)) {
      return;
    }

    if (storedValue !== null && pendingOperator !== null) {
      const percentage = (storedValue * currentValue) / 100;

      if (pendingOperator === '×' || pendingOperator === '÷') {
        const result = pendingOperator === '×'
          ? storedValue * (currentValue / 100)
          : storedValue / (currentValue / 100);

        commitValue(result);
        setStoredValue(result);
        setPendingOperator(null);
        setWaitingForOperand(true);
        setCompletedExpression(
          `${formatNumber(storedValue)} ${pendingOperator} ${formatNumber(currentValue)}% =`,
        );
      } else {
        commitValue(percentage);
        setWaitingForOperand(true);
      }
      return;
    }

    const percentage = currentValue / 100;
    setStoredValue(percentage);
    setPendingOperator('×');
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
    setCompletedExpression(null);
  };

  const handleClearAll = () => {
    setDisplayValue('0');
    setStoredValue(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
    setCompletedExpression(null);
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

  const expressionDisplay = useMemo(() => {
    if (completedExpression) {
      return completedExpression;
    }

    if (pendingOperator && storedValue !== null) {
      if (waitingForOperand) {
        return `${formatNumber(storedValue)} ${pendingOperator}`;
      }

      return `${formatNumber(storedValue)} ${pendingOperator} ${formattedDisplay}`;
    }

    return '';
  }, [completedExpression, formattedDisplay, pendingOperator, storedValue, waitingForOperand]);

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
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Standard</Text>
              <Text style={styles.headerSubtitle}>Calculator</Text>
            </View>
          </View>

          {/* <View style={styles.memoryRow}>
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
          </View> */}

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
          {expressionDisplay ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              style={styles.expressionText}
            >
              {expressionDisplay}
            </Text>
          ) : null}
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
    gap: 8,
  },
  headerTextGroup: {
    marginTop: 25,
    gap: 4,
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
  expressionText: {
    fontSize: 20,
    color: '#7f7f7f',
    marginBottom: 8,
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
});
