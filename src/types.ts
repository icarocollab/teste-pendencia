export type Status = 'analise' | 'externo' | 'imoc' | 'validacao' | 'concluido';

export interface Comment {
  id: string;
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  comments: Comment[];
  status: Status;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
}

export const COLUMNS: { id: Status; title: string }[] = [
  { id: 'analise', title: 'Em Análise' },
  { id: 'externo', title: 'Chamado Externo' },
  { id: 'imoc', title: 'Chamado IMOC' },
  { id: 'validacao', title: 'Aguardando Validação' },
  { id: 'concluido', title: 'Concluído' },
];
