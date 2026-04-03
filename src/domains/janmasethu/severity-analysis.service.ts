import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SeverityAnalysisService {
  private readonly logger = new Logger(SeverityAnalysisService.name);

  // Define keywords and their associated risk weights
  private readonly RISK_KEYWORDS = {
    'chest pain': 40,
    'bleeding': 40,
    'shortness of breath': 40,
    'severe pain': 30,
    'high fever': 25,
    'dizziness': 20,
    'dizzy': 20,
    'fainting': 35,
    'faint': 35,
    'numbness': 25,
    'swelling': 15,
    'coughing blood': 45,
    'suicidal': 50,
    'emergency': 30,
  };

  // Red flag clusters (combinations of symptoms)
  private readonly RED_FLAG_CLUSTERS = [
    { symptoms: ['chest pain', 'shortness of breath'], bonus: 20 },
    { symptoms: ['high fever', 'dizziness'], bonus: 15 },
    { symptoms: ['bleeding', 'pain'], bonus: 10 },
  ];

  // Urgent sentiment markers
  private readonly SENTIMENT_MARKERS = [
    'help', 'urgent', 'immediately', 'now', 'worsening', 'cannot breathe', 'intense'
  ];

  /**
   * Evaluates the severity of a patient interaction based on content.
   * Returns a score between 0 and 100.
   */
  evaluateSeverity(content: string): { score: number; flags: string[]; severity: 'GREEN' | 'YELLOW' | 'RED' } {
    const normalizedContent = content.toLowerCase();
    let score = 0;
    const flags: string[] = [];

    // 1. Keyword Analysis
    Object.entries(this.RISK_KEYWORDS).forEach(([keyword, weight]) => {
      if (normalizedContent.includes(keyword)) {
        score += weight;
        flags.push(keyword);
      }
    });

    // 2. Red Flag Cluster Bonus
    this.RED_FLAG_CLUSTERS.forEach(cluster => {
      const matchCount = cluster.symptoms.filter(s => normalizedContent.includes(s)).length;
      if (matchCount >= cluster.symptoms.length) {
        score += cluster.bonus;
        flags.push(`CLUSTER: ${cluster.symptoms.join(' + ')}`);
      }
    });

    // 3. Sentiment & Urgency Analysis
    this.SENTIMENT_MARKERS.forEach(marker => {
      if (normalizedContent.includes(marker)) {
        score += 10;
        flags.push(`URGENT: ${marker}`);
      }
    });

    // Cap the score at 100
    const finalScore = Math.min(score, 100);

    // Determine Severity Level
    let severity: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (finalScore > 70) {
      severity = 'RED';
    } else if (finalScore > 30) {
      severity = 'YELLOW';
    }

    this.logger.log(`Severity analyzed. Content: "${content.substring(0, 50)}...", Score: ${finalScore}, Severity: ${severity}`);

    return {
      score: finalScore,
      flags,
      severity
    };
  }
}
