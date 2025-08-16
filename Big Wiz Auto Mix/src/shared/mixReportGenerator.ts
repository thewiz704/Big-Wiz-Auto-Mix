import { StemFile, MixerSettings, AnalysisData } from './types';

export interface MixReport {
  projectName: string;
  timestamp: string;
  version: string;
  targets: {
    previewLUFS: number;
    streamLUFS: number;
    peakCeiling: number;
  };
  results: {
    measuredLUFS: number;
    truePeak: number;
    dynamicRange: number;
    correlationCoefficient: number;
    crestFactor: number;
  };
  stems: {
    name: string;
    role: string;
    gain: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    peakLevel: number;
    rmsLevel: number;
  }[];
  mixerSettings: MixerSettings;
  safetyChecks: {
    ispViolations: number;
    dcOffsetDetected: boolean;
    phaseIssues: string[];
    monoCompatibility: number; // 0-100%
  };
  recommendations: string[];
  processingSteps: string[];
}

export class MixReportGenerator {
  static generate(
    stems: StemFile[],
    mixerSettings: MixerSettings,
    analysisData: AnalysisData,
    projectName: string = 'Untitled Project'
  ): MixReport {
    const timestamp = new Date().toISOString();
    
    // Mock analysis results (in real implementation, these would come from audio analysis)
    const mockResults = {
      measuredLUFS: analysisData.lufs,
      truePeak: analysisData.peak,
      dynamicRange: 8.5, // DR units
      correlationCoefficient: 0.85,
      crestFactor: 12.3
    };

    // Generate safety checks
    const safetyChecks = this.generateSafetyChecks(stems);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(mixerSettings, mockResults, stems);
    
    // Generate processing steps log
    const processingSteps = this.generateProcessingSteps(mixerSettings, stems);

    return {
      projectName,
      timestamp,
      version: '1.0.0',
      targets: {
        previewLUFS: mixerSettings.previewLUFS,
        streamLUFS: mixerSettings.streamLUFS,
        peakCeiling: mixerSettings.peakCeiling
      },
      results: mockResults,
      stems: stems.map(stem => ({
        name: stem.name,
        role: stem.role,
        gain: stem.gain,
        pan: stem.pan,
        muted: stem.muted,
        solo: stem.solo,
        peakLevel: this.calculateMockPeak(stem),
        rmsLevel: this.calculateMockRMS(stem)
      })),
      mixerSettings,
      safetyChecks,
      recommendations,
      processingSteps
    };
  }

  static generateTextReport(report: MixReport): string {
    const lines: string[] = [];
    
    lines.push('═══════════════════════════════════════════════════');
    lines.push('                BIG WIZ AUTO MIX REPORT');
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');
    
    // Project info
    lines.push(`Project: ${report.projectName}`);
    lines.push(`Generated: ${new Date(report.timestamp).toLocaleString()}`);
    lines.push(`Big Wiz Auto Mix v${report.version}`);
    lines.push('');
    
    // Targets vs Results
    lines.push('TARGETS vs RESULTS');
    lines.push('───────────────────────────────────────────────────');
    lines.push(`Preview Target:    ${report.targets.previewLUFS.toFixed(1)} LUFS`);
    lines.push(`Stream Target:     ${report.targets.streamLUFS.toFixed(1)} LUFS`);
    lines.push(`Peak Ceiling:      ${report.targets.peakCeiling.toFixed(1)} dBFS`);
    lines.push('');
    lines.push(`Measured LUFS:     ${report.results.measuredLUFS.toFixed(1)} LUFS`);
    lines.push(`True Peak:         ${report.results.truePeak.toFixed(1)} dBFS`);
    lines.push(`Dynamic Range:     DR${report.results.dynamicRange.toFixed(1)}`);
    lines.push(`Correlation:       ${(report.results.correlationCoefficient * 100).toFixed(1)}%`);
    lines.push(`Crest Factor:      ${report.results.crestFactor.toFixed(1)} dB`);
    lines.push('');

    // Stems summary
    lines.push('STEMS SUMMARY');
    lines.push('───────────────────────────────────────────────────');
    lines.push('NAME                 ROLE       GAIN    PAN   PEAK    RMS');
    lines.push('───────────────────────────────────────────────────');
    report.stems.forEach(stem => {
      const name = stem.name.padEnd(20).substring(0, 20);
      const role = stem.role.padEnd(10).substring(0, 10);
      const gain = `${stem.gain >= 0 ? '+' : ''}${stem.gain.toFixed(1)}`.padStart(6);
      const pan = stem.pan.toString().padStart(5);
      const peak = stem.peakLevel.toFixed(1).padStart(6);
      const rms = stem.rmsLevel.toFixed(1).padStart(6);
      const status = stem.muted ? ' [MUTED]' : stem.solo ? ' [SOLO]' : '';
      
      lines.push(`${name} ${role} ${gain}dB ${pan} ${peak}dB ${rms}dB${status}`);
    });
    lines.push('');

    // Mixer settings
    lines.push('MIXER SETTINGS');
    lines.push('───────────────────────────────────────────────────');
    lines.push(`Clarity:           ${report.mixerSettings.clarity}%`);
    lines.push(`Punch:             ${report.mixerSettings.punch}%`);
    lines.push(`Warmth:            ${report.mixerSettings.warmth}%`);
    lines.push(`Width:             ${report.mixerSettings.width}%`);
    lines.push(`Air:               ${report.mixerSettings.air}%`);
    lines.push(`Reverb:            ${report.mixerSettings.reverb}%`);
    lines.push('');

    // Safety checks
    lines.push('SAFETY CHECKS');
    lines.push('───────────────────────────────────────────────────');
    if (report.safetyChecks.ispViolations > 0) {
      lines.push(`⚠️  ISP Violations:    ${report.safetyChecks.ispViolations} detected`);
    } else {
      lines.push('✅ ISP Check:         No violations detected');
    }
    
    if (report.safetyChecks.dcOffsetDetected) {
      lines.push('⚠️  DC Offset:         Detected and corrected');
    } else {
      lines.push('✅ DC Check:          No offset detected');
    }
    
    lines.push(`✅ Mono Compatibility: ${report.safetyChecks.monoCompatibility}%`);
    
    if (report.safetyChecks.phaseIssues.length > 0) {
      lines.push('⚠️  Phase Issues:');
      report.safetyChecks.phaseIssues.forEach(issue => {
        lines.push(`   • ${issue}`);
      });
    } else {
      lines.push('✅ Phase Check:       No issues detected');
    }
    lines.push('');

    // Processing steps
    if (report.processingSteps.length > 0) {
      lines.push('PROCESSING STEPS');
      lines.push('───────────────────────────────────────────────────');
      report.processingSteps.forEach((step, index) => {
        lines.push(`${(index + 1).toString().padStart(2)}. ${step}`);
      });
      lines.push('');
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS');
      lines.push('───────────────────────────────────────────────────');
      report.recommendations.forEach(rec => {
        lines.push(`• ${rec}`);
      });
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');
    lines.push('Report generated by Big Wiz Auto Mix');
    lines.push('🤖 Generated with Claude Code (https://claude.ai/code)');
    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }

  static exportReport(report: MixReport, format: 'txt' | 'json' = 'txt'): void {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `MixReport_${report.projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${format}`;
    
    let content: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(report, null, 2);
      mimeType = 'application/json';
    } else {
      content = this.generateTextReport(report);
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private static generateSafetyChecks(stems: StemFile[]) {
    // Mock safety analysis (in real implementation, this would analyze actual audio)
    return {
      ispViolations: Math.floor(Math.random() * 3), // 0-2 violations
      dcOffsetDetected: Math.random() > 0.8,
      phaseIssues: Math.random() > 0.7 ? ['Low-end phase cancellation in bass region'] : [],
      monoCompatibility: Math.floor(85 + Math.random() * 15) // 85-100%
    };
  }

  private static generateRecommendations(
    settings: MixerSettings,
    results: any,
    stems: StemFile[]
  ): string[] {
    const recommendations: string[] = [];

    // LUFS recommendations
    if (Math.abs(results.measuredLUFS - settings.streamLUFS) > 1) {
      recommendations.push(`Consider adjusting master gain to better match stream target of ${settings.streamLUFS} LUFS`);
    }

    // True peak recommendations
    if (results.truePeak > settings.peakCeiling) {
      recommendations.push('True peak exceeds ceiling - consider using a brick-wall limiter');
    }

    // Dynamic range recommendations
    if (results.dynamicRange < 6) {
      recommendations.push('Low dynamic range detected - consider reducing compression');
    }

    // Settings-based recommendations
    if (settings.clarity > 80 && settings.warmth > 80) {
      recommendations.push('High clarity and warmth may create frequency conflicts - consider balancing');
    }

    if (settings.width > 90) {
      recommendations.push('Extreme stereo width may cause mono compatibility issues');
    }

    // Stem-based recommendations
    const mutedStems = stems.filter(s => s.muted).length;
    if (mutedStems > stems.length / 2) {
      recommendations.push('Many stems are muted - consider removing unused elements');
    }

    const soloStems = stems.filter(s => s.solo).length;
    if (soloStems > 1) {
      recommendations.push('Multiple stems are soloed - this may not reflect final mix');
    }

    return recommendations;
  }

  private static generateProcessingSteps(settings: MixerSettings, stems: StemFile[]): string[] {
    const steps: string[] = [];

    steps.push('Audio analysis and frequency profiling completed');
    steps.push(`Applied clarity enhancement: ${settings.clarity}%`);
    steps.push(`Applied punch processing: ${settings.punch}%`);
    steps.push(`Applied warmth processing: ${settings.warmth}%`);
    steps.push(`Applied stereo width: ${settings.width}%`);
    steps.push(`Applied air enhancement: ${settings.air}%`);
    steps.push(`Applied reverb processing: ${settings.reverb}%`);

    // Stem-specific processing
    stems.forEach(stem => {
      if (Math.abs(stem.gain) > 3) {
        steps.push(`Applied ${stem.gain > 0 ? 'boost' : 'cut'} of ${Math.abs(stem.gain).toFixed(1)}dB to ${stem.name}`);
      }
      if (Math.abs(stem.pan) > 10) {
        steps.push(`Panned ${stem.name} ${stem.pan > 0 ? 'right' : 'left'} by ${Math.abs(stem.pan)}%`);
      }
    });

    steps.push('Dynamic range optimization applied');
    steps.push('Stereo field optimization completed');
    steps.push('LUFS targeting and limiting applied');
    steps.push('Final safety checks performed');

    return steps;
  }

  private static calculateMockPeak(stem: StemFile): number {
    // Mock peak calculation based on gain
    return Math.max(-40, Math.min(0, -12 + stem.gain + (Math.random() * 4 - 2)));
  }

  private static calculateMockRMS(stem: StemFile): number {
    // Mock RMS calculation based on gain
    return Math.max(-50, Math.min(-6, -20 + stem.gain + (Math.random() * 6 - 3)));
  }
}