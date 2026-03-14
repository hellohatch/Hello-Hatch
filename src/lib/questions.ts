// Leadership Risk Intelligence™ — Assessment Instrument v3.0
// 30 Signal Questions + 5 Load Questions + 1 Orientation Question
// All signal items scored 1–5 (1=Never/Strongly Disagree → 5=Always/Strongly Agree)

import type { Question, DomainMeta, SignalDomain } from '../types/index.js';

// ─────────────────────────────────────────────
// DOMAIN METADATA
// ─────────────────────────────────────────────
export const DOMAIN_META: DomainMeta[] = [
  {
    key: 'stress_regulation',
    label: 'Stress Regulation',
    shortLabel: 'Stress Reg.',
    color: '#6366F1',
    description: 'Capacity to maintain performance under pressure without behavioral regression.',
    questions: ['Q01','Q02','Q03','Q04','Q05'],
  },
  {
    key: 'cognitive_breadth',
    label: 'Cognitive Breadth',
    shortLabel: 'Cog. Breadth',
    color: '#8B5CF6',
    description: 'Range and integration of strategic thinking across multiple domains.',
    questions: ['Q06','Q07','Q08','Q09','Q10'],
  },
  {
    key: 'trust_climate',
    label: 'Trust Climate',
    shortLabel: 'Trust',
    color: '#06B6D4',
    description: 'Degree to which the leader creates psychological safety and relational trust.',
    questions: ['Q11','Q12','Q13','Q14','Q15'],
  },
  {
    key: 'ethical_integrity',
    label: 'Ethical Integrity',
    shortLabel: 'Integrity',
    color: '#10B981',
    description: 'Consistency between stated values and behavioral choices under pressure.',
    questions: ['Q16','Q17','Q18','Q19','Q20'],
  },
  {
    key: 'leadership_durability',
    label: 'Leadership Durability',
    shortLabel: 'Durability',
    color: '#F59E0B',
    description: 'Sustained effectiveness over time without capacity erosion.',
    questions: ['Q21','Q22','Q23','Q24','Q25'],
  },
  {
    key: 'adaptive_capacity',
    label: 'Adaptive Capacity',
    shortLabel: 'Adaptive',
    color: '#EF4444',
    description: 'Speed and quality of recalibration when conditions change.',
    questions: ['Q26','Q27','Q28','Q29','Q30'],
  },
];

// ─────────────────────────────────────────────
// FULL QUESTION BANK (36 items)
// ─────────────────────────────────────────────
export const QUESTIONS: Question[] = [

  // ── DOMAIN 1: STRESS REGULATION (Q01–Q05) ──
  {
    id: 'Q01', domain: 'stress_regulation', scored: true,
    text: 'I maintain consistent decision quality even when workload pressures intensify.',
  },
  {
    id: 'Q02', domain: 'stress_regulation', scored: true,
    text: 'When facing organizational stress, I remain behaviorally predictable to my team.',
  },
  {
    id: 'Q03', domain: 'stress_regulation', scored: true,
    text: 'I recover quickly from high-pressure situations without residual impact on my judgment.',
  },
  {
    id: 'Q04', domain: 'stress_regulation', scored: true, reverse: true,
    text: 'In recent weeks, sustained pressure has noticeably affected the quality of my thinking.',
  },
  {
    id: 'Q05', domain: 'stress_regulation', scored: true,
    text: 'I can absorb elevated organizational demands without compromising the capacity of those around me.',
  },

  // ── DOMAIN 2: COGNITIVE BREADTH (Q06–Q10) ──
  {
    id: 'Q06', domain: 'cognitive_breadth', scored: true,
    text: 'My decisions consistently reflect the integration of financial, operational, and people dynamics.',
  },
  {
    id: 'Q07', domain: 'cognitive_breadth', scored: true,
    text: 'I actively seek perspectives that challenge or complicate my initial analysis.',
  },
  {
    id: 'Q08', domain: 'cognitive_breadth', scored: true,
    text: 'I can hold strategic complexity and ambiguity without forcing premature resolution.',
  },
  {
    id: 'Q09', domain: 'cognitive_breadth', scored: true, reverse: true,
    text: 'I find myself defaulting to familiar frameworks rather than engaging with novel strategic challenges.',
  },
  {
    id: 'Q10', domain: 'cognitive_breadth', scored: true,
    text: 'I regularly translate complex signals from multiple domains into clear organizational direction.',
  },

  // ── DOMAIN 3: TRUST CLIMATE (Q11–Q15) ──
  {
    id: 'Q11', domain: 'trust_climate', scored: true,
    text: 'Members of my team openly share concerns, dissenting views, and critical signals with me.',
  },
  {
    id: 'Q12', domain: 'trust_climate', scored: true,
    text: 'I consistently follow through on commitments made to my direct reports and peers.',
  },
  {
    id: 'Q13', domain: 'trust_climate', scored: true,
    text: 'I have created conditions where disagreement is welcomed rather than managed or suppressed.',
  },
  {
    id: 'Q14', domain: 'trust_climate', scored: true, reverse: true,
    text: 'I sense that people around me filter or soften information before sharing it with me.',
  },
  {
    id: 'Q15', domain: 'trust_climate', scored: true,
    text: 'My team has high confidence in my consistency and predictability as a leader.',
  },

  // ── DOMAIN 4: ETHICAL INTEGRITY (Q16–Q20) ──
  {
    id: 'Q16', domain: 'ethical_integrity', scored: true,
    text: 'I act in alignment with stated organizational values even when it creates personal cost or inconvenience.',
  },
  {
    id: 'Q17', domain: 'ethical_integrity', scored: true,
    text: 'I am transparent with stakeholders about risks, setbacks, and uncomfortable truths.',
  },
  {
    id: 'Q18', domain: 'ethical_integrity', scored: true, reverse: true,
    text: 'I have felt pressure to compromise ethical standards to achieve short-term results.',
  },
  {
    id: 'Q19', domain: 'ethical_integrity', scored: true,
    text: 'My behavior is consistent whether or not I believe I am being observed.',
  },
  {
    id: 'Q20', domain: 'ethical_integrity', scored: true,
    text: 'I take clear accountability for decisions that did not produce the intended outcome.',
  },

  // ── DOMAIN 5: LEADERSHIP DURABILITY (Q21–Q25) ──
  {
    id: 'Q21', domain: 'leadership_durability', scored: true,
    text: 'I maintain high performance quality across varying levels of organizational pressure over extended periods.',
  },
  {
    id: 'Q22', domain: 'leadership_durability', scored: true,
    text: 'I have sufficient recovery and restoration to sustain my leadership effectiveness over time.',
  },
  {
    id: 'Q23', domain: 'leadership_durability', scored: true, reverse: true,
    text: 'Sustained demand has begun to erode the quality of my decision-making.',
  },
  {
    id: 'Q24', domain: 'leadership_durability', scored: true,
    text: 'I can absorb organizational stress without it meaningfully compromising my effectiveness.',
  },
  {
    id: 'Q25', domain: 'leadership_durability', scored: true, reverse: true,
    text: 'I have noticed myself relying on reactive patterns more frequently than I would like.',
  },

  // ── DOMAIN 6: ADAPTIVE CAPACITY (Q26–Q30) ──
  {
    id: 'Q26', domain: 'adaptive_capacity', scored: true,
    text: 'I recalibrate my approach quickly in response to meaningful changes in the environment.',
  },
  {
    id: 'Q27', domain: 'adaptive_capacity', scored: true,
    text: 'I can shift strategic priorities without losing organizational momentum.',
  },
  {
    id: 'Q28', domain: 'adaptive_capacity', scored: true, reverse: true,
    text: 'I have resisted changing course even when new information clearly indicated I should.',
  },
  {
    id: 'Q29', domain: 'adaptive_capacity', scored: true,
    text: 'I model adaptive behavior that helps my team remain agile under pressure.',
  },
  {
    id: 'Q30', domain: 'adaptive_capacity', scored: true, reverse: true,
    text: 'The pace of change in my environment has exceeded my capacity to adapt effectively.',
  },

  // ── LEADERSHIP LOAD (Q31–Q35) ──
  {
    id: 'Q31', domain: 'load', scored: true,
    text: 'The volume of decisions requiring my direct input is high.',
  },
  {
    id: 'Q32', domain: 'load', scored: true,
    text: 'Issues are frequently escalated to me that could be resolved at lower levels of the organization.',
  },
  {
    id: 'Q33', domain: 'load', scored: true,
    text: 'I am currently leading or directly accountable for multiple cross-functional strategic initiatives simultaneously.',
  },
  {
    id: 'Q34', domain: 'load', scored: true,
    text: 'My role requires me to interpret ambiguous organizational signals and translate them into clear direction.',
  },
  {
    id: 'Q35', domain: 'load', scored: true,
    text: 'The breadth of domains competing for my attention and judgment is substantial.',
  },

  // ── FUTURE ORIENTATION (Q36) — NOT SCORED ──
  {
    id: 'Q36', domain: 'orientation', scored: false,
    text: 'In one sentence, describe the leadership impact you most want to be known for three years from now.',
  },
];

// Convenience maps
export const SIGNAL_QUESTIONS = QUESTIONS.filter(q => q.domain !== 'load' && q.domain !== 'orientation' && q.scored);
export const LOAD_QUESTIONS   = QUESTIONS.filter(q => q.domain === 'load');
export const ORIENTATION_Q    = QUESTIONS.find(q => q.domain === 'orientation')!;

export const DOMAIN_KEYS: SignalDomain[] = [
  'stress_regulation','cognitive_breadth','trust_climate',
  'ethical_integrity','leadership_durability','adaptive_capacity',
];
