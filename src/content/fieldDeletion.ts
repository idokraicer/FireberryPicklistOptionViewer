export interface CustomField {
  fieldName: string;
  displayName: string;
  typeLabel: string;
  apiType?: string;
}

export type FieldDependencyKind =
  | 'page'
  | 'view'
  | 'automation'
  | 'field'
  | 'dashboard';

export interface FieldDependency {
  kind: FieldDependencyKind;
  name: string;
  url?: string;
}

export function getShortUserFacingMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const message = value.trim();
  if (!message || message.length > 240) return null;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message)) return null;
  if (/<(?:!doctype|html|head|body|script|style|title)\b/i.test(message)) return null;

  return message;
}

export function createFieldsMetadataRequest(): RequestInit {
  return {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: '{}',
  };
}

export function extractRecordFormObjectType(payload: unknown): number | null {
  const visited = new Set<object>();

  const search = (value: unknown): number | null => {
    if (!value || typeof value !== 'object' || visited.has(value)) return null;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const result = search(item);
        if (result) return result;
      }
      return null;
    }

    const record = value as Record<string, unknown>;
    if (record.name === 'RecordForm' && record.props && typeof record.props === 'object') {
      const props = record.props as Record<string, unknown>;
      const objectType = Number(props.objectType ?? props.ObjectType);
      if (Number.isInteger(objectType) && objectType > 0) return objectType;
    }

    for (const nested of Object.values(record)) {
      const result = search(nested);
      if (result) return result;
    }
    return null;
  };

  return search(payload);
}

export function parseCustomFields(payload: unknown): CustomField[] {
  const fields = new Map<string, CustomField>();
  const visited = new Set<object>();

  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as Record<string, unknown>;
    const fieldName = getFirstString(record, [
      'fieldname',
      'fieldName',
      'FieldName',
      'systemName',
      'SystemName',
    ]);

    if (fieldName?.toLowerCase().startsWith('pcf')) {
      const key = fieldName.toLowerCase();
      if (!fields.has(key)) {
        const apiType = getFirstString(record, [
          'typename',
          'typeName',
          'TypeName',
          'fieldTypeName',
          'FieldTypeName',
          'fieldtype',
          'fieldType',
          'FieldType',
          'type',
          'Type',
        ]);
        fields.set(key, {
          fieldName,
          displayName:
            getFirstString(record, [
              'displayName',
              'DisplayName',
              'fieldlabel',
              'fieldLabel',
              'FieldLabel',
              'label',
              'Label',
              'title',
              'Title',
              'name',
              'Name',
            ]) ?? fieldName,
          typeLabel:
            getFirstString(record, [
              'typeLabel',
              'TypeLabel',
              'fieldTypeName',
              'FieldTypeName',
              'fieldType',
              'FieldType',
              'typename',
              'typeName',
              'type',
              'fieldtype',
            ]) ?? '—',
          ...(apiType ? { apiType } : {}),
        });
      }
    }

    Object.values(record).forEach(visit);
  };

  visit(payload);
  return [...fields.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, 'he')
  );
}

export function filterCustomFields(
  fields: CustomField[],
  query: string
): CustomField[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('he');
  if (!normalizedQuery) return fields;

  return fields.filter(
    (field) =>
      field.displayName.toLocaleLowerCase('he').includes(normalizedQuery) ||
      field.fieldName.toLocaleLowerCase('he').includes(normalizedQuery)
  );
}

export function containsApiErrorCode(
  payload: unknown,
  errorCode: string
): boolean {
  const visited = new Set<object>();

  const search = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim() === errorCode;
    if (!value || typeof value !== 'object' || visited.has(value)) return false;

    visited.add(value);
    if (Array.isArray(value)) return value.some(search);
    return Object.values(value).some(search);
  };

  return search(payload);
}

export function normalizeFieldTypeForApi(typeLabel: string): string | null {
  const normalized = typeLabel.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, string> = {
    text: 'text',
    string: 'text',
    textarea: 'textarea',
    longtext: 'textarea',
    number: 'number',
    numeric: 'number',
    picklist: 'picklist',
    dropdown: 'picklist',
    lookup: 'lookup',
    formula: 'formula',
    summary: 'summary',
    rollup: 'summary',
    email: 'email',
    url: 'url',
    phone: 'phone',
    telephone: 'phone',
    date: 'date',
    datetime: 'datetime',
    html: 'html',
  };

  return aliases[normalized] ?? null;
}

export function extractFieldDependencies(
  payload: unknown,
  objectType: number
): FieldDependency[] {
  const dependencies = new Map<string, FieldDependency>();
  const visited = new Set<object>();

  const addDependency = (
    kind: FieldDependencyKind,
    name: string,
    record?: Record<string, unknown>
  ): void => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 240 || /^[A-Z][A-Z0-9_]+$/.test(trimmedName)) {
      return;
    }

    const id = record ? getDependencyId(record, kind) : null;
    const explicitUrl = record ? getSafeFireberryUrl(record) : null;
    const generatedUrl = id ? getDependencyUrl(kind, id, objectType) : null;
    const dependency: FieldDependency = {
      kind,
      name: trimmedName,
      ...(explicitUrl || generatedUrl ? { url: explicitUrl ?? generatedUrl ?? undefined } : {}),
    };
    dependencies.set(`${kind}:${trimmedName.toLowerCase()}:${id ?? ''}`, dependency);
  };

  const visit = (value: unknown, inheritedKind: FieldDependencyKind | null): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && inheritedKind) addDependency(inheritedKind, item);
        else visit(item, inheritedKind);
      }
      return;
    }

    const record = value as Record<string, unknown>;
    const kind = getDependencyKind(record) ?? inheritedKind;
    const name = getDependencyName(record);
    if (kind && name) addDependency(kind, name, record);

    for (const [key, nested] of Object.entries(record)) {
      visit(nested, dependencyKindFromText(key) ?? kind);
    }
  };

  visit(payload, null);
  return [...dependencies.values()];
}

function getDependencyKind(
  record: Record<string, unknown>
): FieldDependencyKind | null {
  const discriminatorKeys = [
    'type',
    'dependencyType',
    'usageType',
    'entityType',
    'objectTypeName',
    'category',
  ];

  for (const key of discriminatorKeys) {
    const value = getCaseInsensitiveValue(record, key);
    if (typeof value === 'string') {
      const kind = dependencyKindFromText(value);
      if (kind) return kind;
    }
  }

  return dependencyKindFromText(Object.keys(record).join(' '));
}

function dependencyKindFromText(value: string): FieldDependencyKind | null {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, '');
  if (/recordlayout|layout|form|page|עמוד|טופס/.test(normalized)) return 'page';
  if (/view|filter|תצוג|מסנן/.test(normalized)) return 'view';
  if (/automation|workflow|businessrule|אוטומ/.test(normalized)) return 'automation';
  if (/dashboard|widget|דשבורד|ווידג/.test(normalized)) return 'dashboard';
  if (/formula|summary|rollup|field|נוסח|סיכום|שדה/.test(normalized)) return 'field';
  return null;
}

function getDependencyName(record: Record<string, unknown>): string | null {
  const keys = [
    'name',
    'entityName',
    'usageName',
    'displayName',
    'title',
    'label',
    'formName',
    'pageName',
    'layoutName',
    'viewName',
    'ruleName',
    'automationName',
    'fieldLabel',
    'widgetName',
  ];

  for (const key of keys) {
    const value = getCaseInsensitiveValue(record, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function getDependencyId(
  record: Record<string, unknown>,
  kind: FieldDependencyKind
): string | null {
  const keysByKind: Record<FieldDependencyKind, string[]> = {
    page: ['recordLayoutId', 'layoutId', 'formId', 'pageId', 'id'],
    view: ['viewSchemaId', 'viewId', 'id'],
    automation: ['wfruleid', 'ruleId', 'automationId', 'id'],
    field: ['fieldId', 'id'],
    dashboard: ['dashboardId', 'widgetId', 'id'],
  };

  for (const key of keysByKind[kind]) {
    const value = getCaseInsensitiveValue(record, key);
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function getSafeFireberryUrl(record: Record<string, unknown>): string | null {
  for (const key of ['url', 'link', 'editUrl']) {
    const value = getCaseInsensitiveValue(record, key);
    if (typeof value !== 'string') continue;
    if (value.startsWith('/app/') || /^https:\/\/app\.fireberry\.com\/app\//i.test(value)) {
      return value;
    }
  }
  return null;
}

function getDependencyUrl(
  kind: FieldDependencyKind,
  id: string,
  objectType: number
): string | null {
  const encodedId = encodeURIComponent(id);
  if (kind === 'page') return `/app/record/108/${encodedId}`;
  if (kind === 'automation') return `/app/record/55/${encodedId}`;
  if (kind === 'view') return `/app/views/${objectType}/${encodedId}`;
  return null;
}

function getCaseInsensitiveValue(
  record: Record<string, unknown>,
  key: string
): unknown {
  const matchingKey = Object.keys(record).find(
    (candidate) => candidate.toLowerCase() === key.toLowerCase()
  );
  return matchingKey ? record[matchingKey] : undefined;
}

function getFirstString(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}
