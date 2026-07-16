export interface CustomField {
  fieldName: string;
  displayName: string;
  typeLabel: string;
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
